import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  claimCompletionReward,
  claimDailyReward,
  COIN_TRANSACTION_TYPES,
  CompletionRewardAlreadyClaimedError,
  DailyRewardAlreadyClaimedError,
  InsufficientCoinsError,
  spendCoins,
} from "./coinEconomy";
import { getCompletionRewardAmount } from "./completionRewardAmount";

interface LedgerRow {
  userId: number;
  amount: number;
  balanceAfter: number;
  type: string;
  referenceId?: string;
}

interface RewardRow {
  id: number;
  userId: number;
  flashcardSetId: number;
  amount: number;
  claimDate: Date | null;
  studySessionId: string | null;
  createdAt: Date;
}

function createMemoryDatabase(options: {
  balance: number;
  wordCount?: number;
  lastDailyReward?: Date | null;
  completedStudySession?: boolean;
}) {
  const state = {
    balance: options.balance,
    lastDailyReward: options.lastDailyReward ?? null,
    ledger: [] as LedgerRow[],
    rewards: [] as RewardRow[],
  };

  const transaction = {
    user: {
      async updateMany(args: {
        where: {
          id: number;
          coins?: { gte: number };
          OR?: Array<{
            lastDailyReward: null | { lt: Date };
          }>;
        };
        data: {
          coins: { decrement?: number; increment?: number };
          lastDailyReward?: Date;
        };
      }) {
        if (args.where.id !== 1) return { count: 0 };
        if (
          args.where.coins &&
          state.balance < args.where.coins.gte
        ) {
          return { count: 0 };
        }
        if (args.where.OR) {
          const canClaim = args.where.OR.some((condition) => {
            if (condition.lastDailyReward === null) {
              return state.lastDailyReward === null;
            }
            return (
              state.lastDailyReward !== null &&
              state.lastDailyReward < condition.lastDailyReward.lt
            );
          });
          if (!canClaim) return { count: 0 };
        }

        state.balance -= args.data.coins.decrement ?? 0;
        state.balance += args.data.coins.increment ?? 0;
        if (args.data.lastDailyReward) {
          state.lastDailyReward = args.data.lastDailyReward;
        }
        return { count: 1 };
      },
      async findUnique(args: { where: { id: number } }) {
        if (args.where.id !== 1) return null;
        return {
          id: 1,
          coins: state.balance,
          lastDailyReward: state.lastDailyReward,
        };
      },
      async update(args: {
        where: { id: number };
        data: { coins: { increment: number } };
      }) {
        if (args.where.id !== 1) throw new Error("User not found");
        state.balance += args.data.coins.increment;
        return { coins: state.balance };
      },
    },
    coinTransaction: {
      async create(args: { data: LedgerRow }) {
        state.ledger.push(args.data);
        return { id: state.ledger.length, createdAt: new Date(), ...args.data };
      },
    },
    flashcardSet: {
      async findFirst(args: {
        where: { id: number; userId: number };
      }) {
        if (args.where.id !== 10 || args.where.userId !== 1) return null;
        return { id: 10, _count: { words: options.wordCount ?? 10 } };
      },
    },
    studySession: {
      async findFirst(args: {
        where: {
          id: string;
          userId: number;
          flashcardSetId: number;
          isFullSet: boolean;
          completedAt: { not: null };
        };
      }) {
        if (
          options.completedStudySession === false ||
          args.where.id !== "00000000-0000-4000-8000-000000000001" ||
          args.where.userId !== 1 ||
          args.where.flashcardSetId !== 10 ||
          !args.where.isFullSet
        ) {
          return null;
        }
        const wordCount = options.wordCount ?? 10;
        return {
          totalWords: wordCount,
          wordIds: Array.from({ length: wordCount }, (_, index) => index + 1),
        };
      },
    },
    completionReward: {
      async findFirst(args: {
        where: {
          userId: number;
          flashcardSetId: number;
          createdAt: { gte: Date };
        };
      }) {
        return (
          state.rewards.find(
            (reward) =>
              reward.userId === args.where.userId &&
              reward.flashcardSetId === args.where.flashcardSetId &&
              reward.createdAt >= args.where.createdAt.gte,
          ) ?? null
        );
      },
      async aggregate(args: {
        where: { userId: number; createdAt: { gte: Date } };
      }) {
        const amount = state.rewards
          .filter(
            (reward) =>
              reward.userId === args.where.userId &&
              reward.createdAt >= args.where.createdAt.gte,
          )
          .reduce((sum, reward) => sum + reward.amount, 0);
        return { _sum: { amount: amount || null } };
      },
      async create(args: {
        data: Omit<RewardRow, "id" | "createdAt">;
      }) {
        const duplicate = state.rewards.some(
          (reward) =>
            reward.userId === args.data.userId &&
            reward.flashcardSetId === args.data.flashcardSetId &&
            reward.claimDate?.getTime() === args.data.claimDate?.getTime(),
        );
        if (duplicate) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        }
        const reward = {
          id: state.rewards.length + 1,
          createdAt: new Date("2026-07-21T12:00:00.000Z"),
          ...args.data,
        };
        state.rewards.push(reward);
        return reward;
      },
    },
  } as unknown as Prisma.TransactionClient;

  const database = {
    async $transaction<T>(
      operation: (client: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
      return operation(transaction);
    },
  } as unknown as PrismaClient;

  return { database, state };
}

test("concurrent spends cannot make the balance negative", async () => {
  const { database, state } = createMemoryDatabase({ balance: 5 });

  const results = await Promise.allSettled([
    spendCoins(database, 1, 4, COIN_TRANSACTION_TYPES.aiChat),
    spendCoins(database, 1, 4, COIN_TRANSACTION_TYPES.aiChat),
  ]);

  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = results.find(({ status }) => status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof InsufficientCoinsError);
  assert.equal(state.balance, 1);
  assert.deepEqual(state.ledger, [
    {
      userId: 1,
      amount: -4,
      balanceAfter: 1,
      type: "AI_CHAT",
      referenceId: undefined,
    },
  ]);
});

test("the same completion reward can only be claimed once", async () => {
  const { database, state } = createMemoryDatabase({
    balance: 100,
    wordCount: 10,
  });
  const now = new Date("2026-07-21T12:00:00.000Z");

  const results = await Promise.allSettled([
    claimCompletionReward(database, {
      userId: 1,
      flashcardSetId: 10,
      studySessionId: "00000000-0000-4000-8000-000000000001",
      now,
    }),
    claimCompletionReward(database, {
      userId: 1,
      flashcardSetId: 10,
      studySessionId: "00000000-0000-4000-8000-000000000001",
      now,
    }),
  ]);

  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = results.find(({ status }) => status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof CompletionRewardAlreadyClaimedError);
  assert.equal(state.balance, 110);
  assert.equal(state.rewards.length, 1);
  assert.deepEqual(state.ledger, [
    {
      userId: 1,
      amount: 10,
      balanceAfter: 110,
      type: "COMPLETION_REWARD",
      referenceId: "10",
    },
  ]);
});

test("concurrent daily reward claims only credit once", async () => {
  const { database, state } = createMemoryDatabase({ balance: 100 });
  const now = new Date("2026-07-21T12:00:00.000Z");

  const results = await Promise.allSettled([
    claimDailyReward(database, {
      userId: 1,
      amount: 100,
      timezoneOffsetMinutes: 0,
      now,
    }),
    claimDailyReward(database, {
      userId: 1,
      amount: 100,
      timezoneOffsetMinutes: 0,
      now,
    }),
  ]);

  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = results.find(({ status }) => status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof DailyRewardAlreadyClaimedError);
  assert.equal(state.balance, 200);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.ledger[0]?.type, "DAILY_REWARD");
});

test("completion reward requires a completed full study session", async () => {
  const { database, state } = createMemoryDatabase({
    balance: 100,
    wordCount: 10,
    completedStudySession: false,
  });

  await assert.rejects(
    claimCompletionReward(database, {
      userId: 1,
      flashcardSetId: 10,
      studySessionId: "00000000-0000-4000-8000-000000000001",
      now: new Date("2026-07-21T12:00:00.000Z"),
    }),
    { name: "StudySessionNotCompletedError" },
  );
  assert.equal(state.balance, 100);
  assert.equal(state.rewards.length, 0);
  assert.equal(state.ledger.length, 0);
});

test("completion reward amount is derived from the server-side card count", () => {
  assert.equal(getCompletionRewardAmount(1), 1);
  assert.equal(getCompletionRewardAmount(5), 5);
  assert.equal(getCompletionRewardAmount(10), 10);
  assert.equal(getCompletionRewardAmount(25), 25);
});
