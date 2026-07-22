import type { Prisma, PrismaClient } from "@prisma/client";
import {
  COMPLETION_REWARD_LIMITS,
  getCompletionRewardAmount,
} from "./completionRewardAmount";
import { getStartOfLocalDay } from "./dailyReward";

export const COIN_TRANSACTION_TYPES = {
  openingBalance: "OPENING_BALANCE",
  welcomeBonus: "WELCOME_BONUS",
  aiChat: "AI_CHAT",
  wordTranslation: "WORD_TRANSLATION",
  pronunciationGeneration: "PRONUNCIATION_GENERATION",
  ocrExtraction: "OCR_EXTRACTION",
  flashcardGeneration: "FLASHCARD_GENERATION",
  completionReward: "COMPLETION_REWARD",
  dailyReward: "DAILY_REWARD",
  manualAdjustment: "MANUAL_ADJUSTMENT",
} as const;

export type CoinTransactionType =
  (typeof COIN_TRANSACTION_TYPES)[keyof typeof COIN_TRANSACTION_TYPES];

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
  }
}

export class InsufficientCoinsError extends Error {
  constructor(
    readonly requiredCoins: number,
    readonly currentCoins: number,
  ) {
    super("Insufficient AI coins");
    this.name = "InsufficientCoinsError";
  }
}

export class FlashcardSetNotFoundError extends Error {
  constructor() {
    super("Flashcard set not found");
    this.name = "FlashcardSetNotFoundError";
  }
}

export class CompletionRewardAlreadyClaimedError extends Error {
  constructor() {
    super(
      "You have already claimed the reward for this flashcard set today. Come back tomorrow!",
    );
    this.name = "CompletionRewardAlreadyClaimedError";
  }
}

export class StudySessionNotCompletedError extends Error {
  constructor() {
    super("Finish every card in this study round before claiming the reward");
    this.name = "StudySessionNotCompletedError";
  }
}

export class CompletionRewardLimitError extends Error {
  constructor(
    readonly limitType: "hourly" | "daily",
    readonly remaining: number,
  ) {
    const maximum = COMPLETION_REWARD_LIMITS[limitType];
    const label = limitType === "hourly" ? "Hourly" : "Daily";
    super(
      `${label} limit reached. You can earn ${remaining} more AI coins ${
        limitType === "hourly" ? "this hour" : "today"
      }. Maximum is ${maximum} AI coins ${
        limitType === "hourly" ? "per hour" : "per day"
      }.`,
    );
    this.name = "CompletionRewardLimitError";
  }
}

export class DailyRewardAlreadyClaimedError extends Error {
  constructor() {
    super("Daily reward already claimed");
    this.name = "DailyRewardAlreadyClaimedError";
  }
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

function prismaErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

function utcDayStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function spendCoinsInTransaction(
  transaction: Prisma.TransactionClient,
  userId: number,
  amount: number,
  type: CoinTransactionType,
  referenceId?: string,
): Promise<number> {
  assertPositiveInteger(userId, "userId");
  assertPositiveInteger(amount, "amount");

  const updated = await transaction.user.updateMany({
    where: {
      id: userId,
      coins: { gte: amount },
    },
    data: {
      coins: { decrement: amount },
    },
  });

  if (updated.count === 0) {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });
    if (!user) throw new UserNotFoundError();
    throw new InsufficientCoinsError(amount, user.coins);
  }

  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });
  if (!user) throw new UserNotFoundError();

  await transaction.coinTransaction.create({
    data: {
      userId,
      amount: -amount,
      balanceAfter: user.coins,
      type,
      referenceId,
    },
  });

  return user.coins;
}

export async function creditCoinsInTransaction(
  transaction: Prisma.TransactionClient,
  userId: number,
  amount: number,
  type: CoinTransactionType,
  referenceId?: string,
): Promise<number> {
  assertPositiveInteger(userId, "userId");
  assertPositiveInteger(amount, "amount");

  const user = await transaction.user.update({
    where: { id: userId },
    data: { coins: { increment: amount } },
    select: { coins: true },
  });

  await transaction.coinTransaction.create({
    data: {
      userId,
      amount,
      balanceAfter: user.coins,
      type,
      referenceId,
    },
  });

  return user.coins;
}

export async function spendCoins(
  database: PrismaClient,
  userId: number,
  amount: number,
  type: CoinTransactionType,
  referenceId?: string,
): Promise<number> {
  return database.$transaction((transaction) =>
    spendCoinsInTransaction(
      transaction,
      userId,
      amount,
      type,
      referenceId,
    ),
  );
}

export async function creditCoins(
  database: PrismaClient,
  userId: number,
  amount: number,
  type: CoinTransactionType,
  referenceId?: string,
): Promise<number> {
  return database.$transaction((transaction) =>
    creditCoinsInTransaction(
      transaction,
      userId,
      amount,
      type,
      referenceId,
    ),
  );
}

export interface CompletionRewardResult {
  rewardAmount: number;
  newBalance: number;
  hourlyRemaining: number;
  dailyRemaining: number;
}

export async function claimCompletionReward(
  database: PrismaClient,
  input: {
    userId: number;
    flashcardSetId: number;
    studySessionId: string;
    now?: Date;
  },
): Promise<CompletionRewardResult> {
  assertPositiveInteger(input.userId, "userId");
  assertPositiveInteger(input.flashcardSetId, "flashcardSetId");
  if (!input.studySessionId || input.studySessionId.length > 64) {
    throw new StudySessionNotCompletedError();
  }

  const now = input.now ?? new Date();
  const startOfToday = utcDayStart(now);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          const flashcardSet = await transaction.flashcardSet.findFirst({
            where: {
              id: input.flashcardSetId,
              userId: input.userId,
            },
            select: {
              id: true,
              _count: { select: { words: true } },
            },
          });
          if (!flashcardSet) throw new FlashcardSetNotFoundError();

          const studySession = await transaction.studySession.findFirst({
            where: {
              id: input.studySessionId,
              userId: input.userId,
              flashcardSetId: input.flashcardSetId,
              isFullSet: true,
              completedAt: { not: null },
            },
            select: { totalWords: true, wordIds: true },
          });
          if (
            !studySession ||
            studySession.totalWords !== flashcardSet._count.words ||
            studySession.wordIds.length !== flashcardSet._count.words
          ) {
            throw new StudySessionNotCompletedError();
          }

          const rewardAmount = getCompletionRewardAmount(
            flashcardSet._count.words,
          );
          const existing = await transaction.completionReward.findFirst({
            where: {
              userId: input.userId,
              flashcardSetId: input.flashcardSetId,
              createdAt: { gte: startOfToday },
            },
            select: { id: true },
          });
          if (existing) throw new CompletionRewardAlreadyClaimedError();

          const [hourlyRewards, dailyRewards] = await Promise.all([
            transaction.completionReward.aggregate({
              where: {
                userId: input.userId,
                createdAt: { gte: oneHourAgo },
              },
              _sum: { amount: true },
            }),
            transaction.completionReward.aggregate({
              where: {
                userId: input.userId,
                createdAt: { gte: oneDayAgo },
              },
              _sum: { amount: true },
            }),
          ]);

          const hourlyTotal = hourlyRewards._sum.amount ?? 0;
          const dailyTotal = dailyRewards._sum.amount ?? 0;
          if (
            hourlyTotal + rewardAmount >
            COMPLETION_REWARD_LIMITS.hourly
          ) {
            throw new CompletionRewardLimitError(
              "hourly",
              Math.max(0, COMPLETION_REWARD_LIMITS.hourly - hourlyTotal),
            );
          }
          if (
            dailyTotal + rewardAmount > COMPLETION_REWARD_LIMITS.daily
          ) {
            throw new CompletionRewardLimitError(
              "daily",
              Math.max(0, COMPLETION_REWARD_LIMITS.daily - dailyTotal),
            );
          }

          await transaction.completionReward.create({
            data: {
              userId: input.userId,
              amount: rewardAmount,
              flashcardSetId: input.flashcardSetId,
              claimDate: startOfToday,
              studySessionId: input.studySessionId,
            },
          });

          const newBalance = await creditCoinsInTransaction(
            transaction,
            input.userId,
            rewardAmount,
            COIN_TRANSACTION_TYPES.completionReward,
            String(input.flashcardSetId),
          );

          return {
            rewardAmount,
            newBalance,
            hourlyRemaining:
              COMPLETION_REWARD_LIMITS.hourly -
              (hourlyTotal + rewardAmount),
            dailyRemaining:
              COMPLETION_REWARD_LIMITS.daily - (dailyTotal + rewardAmount),
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      const code = prismaErrorCode(error);
      if (code === "P2002") {
        throw new CompletionRewardAlreadyClaimedError();
      }
      if (code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }

  throw new Error("Could not claim completion reward");
}

export async function claimDailyReward(
  database: PrismaClient,
  input: {
    userId: number;
    amount: number;
    timezoneOffsetMinutes: number;
    now?: Date;
  },
): Promise<{ coins: number; lastDailyReward: Date }> {
  assertPositiveInteger(input.userId, "userId");
  assertPositiveInteger(input.amount, "amount");

  const now = input.now ?? new Date();
  const startOfLocalDay = getStartOfLocalDay(
    now,
    input.timezoneOffsetMinutes,
  );

  return database.$transaction(async (transaction) => {
    const updated = await transaction.user.updateMany({
      where: {
        id: input.userId,
        OR: [
          { lastDailyReward: null },
          { lastDailyReward: { lt: startOfLocalDay } },
        ],
      },
      data: {
        coins: { increment: input.amount },
        lastDailyReward: now,
      },
    });

    if (updated.count === 0) {
      const user = await transaction.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!user) throw new UserNotFoundError();
      throw new DailyRewardAlreadyClaimedError();
    }

    const user = await transaction.user.findUnique({
      where: { id: input.userId },
      select: { coins: true, lastDailyReward: true },
    });
    if (!user?.lastDailyReward) throw new UserNotFoundError();

    await transaction.coinTransaction.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        balanceAfter: user.coins,
        type: COIN_TRANSACTION_TYPES.dailyReward,
      },
    });

    return {
      coins: user.coins,
      lastDailyReward: user.lastDailyReward,
    };
  });
}
