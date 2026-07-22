import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  claimCompletionReward,
  claimDailyReward,
  COIN_TRANSACTION_TYPES,
  CompletionRewardAlreadyClaimedError,
  DailyRewardAlreadyClaimedError,
  InsufficientCoinsError,
  spendCoins,
} from "./coinEconomy";
import { prisma } from "./prisma";

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? "";
if (
  process.env.NODE_ENV !== "test" ||
  (!databaseUrl.includes("127.0.0.1") && !databaseUrl.includes("localhost"))
) {
  throw new Error(
    "Coin integration tests require NODE_ENV=test and a local disposable database",
  );
}

test("PostgreSQL enforces atomic coin spending and reward claims", async (t) => {
  const email = `coin-test-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      password: "integration-test-password-hash",
      nickname: "Coin test",
      emailVerified: true,
      coins: 5,
    },
    select: { id: true },
  });
  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  const flashcardSet = await prisma.flashcardSet.create({
    data: {
      name: "Coin test set",
      userId: user.id,
      words: {
        create: Array.from({ length: 10 }, (_, index) => ({
          word: `word-${index}`,
          translation: `translation-${index}`,
          userId: user.id,
        })),
      },
    },
    select: { id: true, words: { select: { id: true } } },
  });
  const studySession = await prisma.studySession.create({
    data: {
      userId: user.id,
      flashcardSetId: flashcardSet.id,
      wordIds: flashcardSet.words.map((word) => word.id),
      totalWords: 10,
      isFullSet: true,
      completedAt: new Date("2026-07-21T11:59:00.000Z"),
    },
    select: { id: true },
  });

  const spends = await Promise.allSettled([
    spendCoins(prisma, user.id, 4, COIN_TRANSACTION_TYPES.aiChat),
    spendCoins(prisma, user.id, 4, COIN_TRANSACTION_TYPES.aiChat),
  ]);
  assert.equal(spends.filter(({ status }) => status === "fulfilled").length, 1);
  const rejectedSpend = spends.find(({ status }) => status === "rejected");
  assert.ok(rejectedSpend && rejectedSpend.status === "rejected");
  assert.ok(rejectedSpend.reason instanceof InsufficientCoinsError);

  const now = new Date("2026-07-21T12:00:00.000Z");
  const completionClaims = await Promise.allSettled([
    claimCompletionReward(prisma, {
      userId: user.id,
      flashcardSetId: flashcardSet.id,
      studySessionId: studySession.id,
      now,
    }),
    claimCompletionReward(prisma, {
      userId: user.id,
      flashcardSetId: flashcardSet.id,
      studySessionId: studySession.id,
      now,
    }),
  ]);
  assert.equal(
    completionClaims.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  const rejectedCompletion = completionClaims.find(
    ({ status }) => status === "rejected",
  );
  assert.ok(rejectedCompletion && rejectedCompletion.status === "rejected");
  assert.ok(
    rejectedCompletion.reason instanceof CompletionRewardAlreadyClaimedError,
  );

  const dailyClaims = await Promise.allSettled([
    claimDailyReward(prisma, {
      userId: user.id,
      amount: 100,
      timezoneOffsetMinutes: 0,
      now,
    }),
    claimDailyReward(prisma, {
      userId: user.id,
      amount: 100,
      timezoneOffsetMinutes: 0,
      now,
    }),
  ]);
  assert.equal(
    dailyClaims.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  const rejectedDaily = dailyClaims.find(
    ({ status }) => status === "rejected",
  );
  assert.ok(rejectedDaily && rejectedDaily.status === "rejected");
  assert.ok(rejectedDaily.reason instanceof DailyRewardAlreadyClaimedError);

  const finalUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { coins: true },
  });
  assert.equal(finalUser.coins, 111);

  const transactions = await prisma.coinTransaction.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    select: { amount: true, balanceAfter: true, type: true },
  });
  assert.deepEqual(transactions, [
    { amount: -4, balanceAfter: 1, type: "AI_CHAT" },
    { amount: 10, balanceAfter: 11, type: "COMPLETION_REWARD" },
    { amount: 100, balanceAfter: 111, type: "DAILY_REWARD" },
  ]);

});
