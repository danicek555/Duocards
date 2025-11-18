import { prisma } from "./prisma";

// Coin costs based on real API costs
export const COIN_COSTS = {
  // Text generation (flashcard generation)
  FLASHCARD_GENERATION: 5, // Base cost for generating flashcards

  // Image generation (expensive - DALL-E 3 costs ~$0.04 per image)
  IMAGE_GENERATION: 80, // Expensive - reflects real cost

  // Audio generation (TTS)
  AUDIO_GENERATION: 5, // Moderate cost

  // Pronunciation generation (cheap - just text)
  PRONUNCIATION_GENERATION: 1, // Very cheap

  // Word translation (cheap - minimal tokens)
  WORD_TRANSLATION: 1, // Very cheap
} as const;

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
