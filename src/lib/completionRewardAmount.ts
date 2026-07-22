export const COMPLETION_REWARD_LIMITS = {
  hourly: 50,
  daily: 100,
} as const;

export function getCompletionRewardAmount(flashcardCount: number): number {
  if (flashcardCount < 5) return 1;
  if (flashcardCount < 10) return 5;
  if (flashcardCount < 25) return 10;
  return 25;
}
