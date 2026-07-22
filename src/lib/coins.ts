import { prisma } from "./prisma";
import {
  COIN_TRANSACTION_TYPES,
  creditCoins,
  spendCoins,
  type CoinTransactionType,
} from "./coinEconomy";

export {
  COIN_TRANSACTION_TYPES,
  InsufficientCoinsError,
} from "./coinEconomy";

/**
 * Check if user has enough coins for an operation
 */
export async function checkCoins(
  userId: number,
  requiredCoins: number
): Promise<{ hasEnough: boolean; currentCoins: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    hasEnough: user.coins >= requiredCoins,
    currentCoins: user.coins,
  };
}

/**
 * Deduct coins from user's balance
 * Returns the new balance
 */
export async function deductCoins(
  userId: number,
  amount: number,
  type: CoinTransactionType,
  referenceId?: string,
): Promise<number> {
  return spendCoins(prisma, userId, amount, type, referenceId);
}

/**
 * Add coins to user's balance
 * Returns the new balance
 */
export async function addCoins(
  userId: number,
  amount: number,
  type: CoinTransactionType = COIN_TRANSACTION_TYPES.manualAdjustment,
  referenceId?: string,
): Promise<number> {
  return creditCoins(prisma, userId, amount, type, referenceId);
}

/**
 * Get user's current coin balance
 */
export async function getCoins(userId: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user.coins;
}
