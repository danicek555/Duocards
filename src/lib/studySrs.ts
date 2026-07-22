export const STUDY_RATINGS = {
  know: "KNOW",
  again: "AGAIN",
} as const;

export type StudyRating = (typeof STUDY_RATINGS)[keyof typeof STUDY_RATINGS];

export interface ReviewState {
  reviewIntervalDays: number;
  reviewEase: number;
  reviewStreak: number;
}

export interface NextReviewState {
  reviewIntervalDays: number;
  reviewEase: number;
  reviewStreak: number;
  nextReviewAt: Date;
}

export interface StudyQueueSelection {
  wordIds: number[];
  dueWords: number;
  isFullSet: boolean;
  isScheduledReview: boolean;
}

const MIN_EASE = 130;
const MAX_EASE = 260;
const MAX_INTERVAL_DAYS = 180;
const AGAIN_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateNextReview(
  state: ReviewState,
  rating: StudyRating,
  now = new Date(),
): NextReviewState {
  const currentInterval = clamp(
    Math.round(state.reviewIntervalDays || 0),
    0,
    MAX_INTERVAL_DAYS,
  );
  const currentEase = clamp(Math.round(state.reviewEase || 220), MIN_EASE, MAX_EASE);

  if (rating === STUDY_RATINGS.again) {
    return {
      reviewIntervalDays: 0,
      reviewEase: Math.max(MIN_EASE, currentEase - 20),
      reviewStreak: 0,
      nextReviewAt: new Date(now.getTime() + AGAIN_DELAY_MS),
    };
  }

  const nextEase = Math.min(MAX_EASE, currentEase + 5);
  let nextInterval: number;
  if (currentInterval === 0 || state.reviewStreak <= 0) {
    nextInterval = 1;
  } else if (currentInterval === 1) {
    nextInterval = 3;
  } else {
    nextInterval = Math.max(
      currentInterval + 1,
      Math.round(currentInterval * (nextEase / 100)),
    );
  }
  nextInterval = Math.min(MAX_INTERVAL_DAYS, nextInterval);

  return {
    reviewIntervalDays: nextInterval,
    reviewEase: nextEase,
    reviewStreak: Math.max(0, state.reviewStreak) + 1,
    nextReviewAt: new Date(now.getTime() + nextInterval * DAY_MS),
  };
}

export function selectStudyQueue(
  words: Array<{ id: number; nextReviewAt: Date | null }>,
  now = new Date(),
): StudyQueueSelection {
  const dueWordIds = words
    .filter((word) => !word.nextReviewAt || word.nextReviewAt <= now)
    .map((word) => word.id);
  const isScheduledReview = dueWordIds.length > 0;
  const wordIds = isScheduledReview ? dueWordIds : words.map((word) => word.id);
  return {
    wordIds,
    dueWords: dueWordIds.length,
    isFullSet: wordIds.length === words.length,
    isScheduledReview,
  };
}

export function getStartOfLocalDay(now: Date, timezoneOffsetMinutes: number) {
  const safeOffset = clamp(Math.round(timezoneOffsetMinutes || 0), -840, 840);
  const local = new Date(now.getTime() - safeOffset * 60 * 1000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + safeOffset * 60 * 1000);
}

function localDateKey(date: Date, timezoneOffsetMinutes: number) {
  const safeOffset = clamp(Math.round(timezoneOffsetMinutes || 0), -840, 840);
  return new Date(date.getTime() - safeOffset * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateStudyStreak(
  reviewDates: Date[],
  now = new Date(),
  timezoneOffsetMinutes = 0,
) {
  const activeDays = new Set(
    reviewDates.map((date) => localDateKey(date, timezoneOffsetMinutes)),
  );
  const today = localDateKey(now, timezoneOffsetMinutes);
  const yesterday = previousDateKey(today);
  let cursor = activeDays.has(today)
    ? today
    : activeDays.has(yesterday)
      ? yesterday
      : null;

  let streak = 0;
  while (cursor && activeDays.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}
