import { prisma } from "./prisma";

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
  amount: number
): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      coins: {
        decrement: amount,
      },
    },
    select: { coins: true },
  });

  return user.coins;
}

/**
 * Add coins to user's balance
 * Returns the new balance
 */
export async function addCoins(
  userId: number,
  amount: number
): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      coins: {
        increment: amount,
      },
    },
    select: { coins: true },
  });

  return user.coins;
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
