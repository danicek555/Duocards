import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  FSRSVersion,
  type Card,
  type Grade,
} from "ts-fsrs";
import { STUDY_RATINGS, type StudyRating } from "./studySrs";

/**
 * FSRS scheduler wrapper. See docs/SRS.md for the full description of the
 * model, the data collected per review and how to build a custom algorithm
 * on top of this later.
 */

export const SCHEDULER_NAME = "fsrs-6";
export const FSRS_LIBRARY_VERSION = FSRSVersion;
export const DESIRED_RETENTION = 0.9;

// Answering "I know" slower than this maps to the FSRS "Hard" grade instead
// of "Good" — the hesitation itself is a memory signal we would otherwise
// throw away with a two-button UI.
export const HARD_RESPONSE_MS = 10_000;

// "Again" keeps the current UX: the card comes back within the session.
const AGAIN_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_INTERVAL_DAYS = 365;

const engine = fsrs(
  generatorParameters({
    request_retention: DESIRED_RETENTION,
    maximum_interval: MAX_INTERVAL_DAYS,
    enable_fuzz: true,
    // Day-based scheduling only; the in-session relearning loop is handled
    // by the AGAIN_DELAY_MS override below instead of sub-day FSRS steps.
    learning_steps: [],
    relearning_steps: [],
  }),
);

export interface FsrsWordState {
  reviewIntervalDays: number;
  reviewEase: number;
  reviewStreak: number;
  reviewCount: number;
  lapseCount: number;
  reviewStability: number | null;
  reviewDifficulty: number | null;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
}

export interface FsrsReviewResult {
  reviewIntervalDays: number;
  reviewEase: number;
  reviewStreak: number;
  nextReviewAt: Date;
  reviewStability: number;
  reviewDifficulty: number;
  // Telemetry for the study_reviews log
  scheduler: string;
  fsrsRating: "AGAIN" | "HARD" | "GOOD" | "EASY";
  elapsedDays: number;
  retrievability: number | null;
  stabilityBefore: number | null;
  difficultyBefore: number | null;
  desiredRetention: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Seed FSRS state for words that were scheduled by the legacy SM-2-lite
 * algorithm (or never reviewed). Stability in FSRS is "days until recall
 * probability drops to 90 %", which is exactly what the legacy interval
 * approximated, so the interval is a reasonable first estimate. Difficulty
 * maps the legacy ease range 130–260 onto FSRS's 1–10 (higher = harder).
 */
export function seedCardFromLegacy(state: FsrsWordState, now: Date): Card {
  const card = createEmptyCard(state.lastReviewedAt ?? now);
  if (state.reviewCount <= 0 || !state.lastReviewedAt) {
    return card;
  }
  card.state = State.Review;
  card.reps = state.reviewCount;
  card.lapses = state.lapseCount;
  card.stability = clamp(state.reviewIntervalDays || 1, 0.1, MAX_INTERVAL_DAYS);
  card.difficulty = clamp(11 - ((state.reviewEase - 130) * 9) / 130, 1, 10);
  card.scheduled_days = state.reviewIntervalDays;
  card.last_review = state.lastReviewedAt;
  card.due = state.nextReviewAt ?? now;
  return card;
}

function cardFromState(state: FsrsWordState, now: Date): Card {
  if (state.reviewStability == null || state.reviewDifficulty == null) {
    return seedCardFromLegacy(state, now);
  }
  const card = createEmptyCard(state.lastReviewedAt ?? now);
  card.state = state.reviewCount > 0 ? State.Review : State.New;
  card.reps = state.reviewCount;
  card.lapses = state.lapseCount;
  card.stability = state.reviewStability;
  card.difficulty = state.reviewDifficulty;
  card.scheduled_days = state.reviewIntervalDays;
  card.last_review = state.lastReviewedAt ?? undefined;
  card.due = state.nextReviewAt ?? now;
  return card;
}

export function mapRatingToGrade(
  rating: StudyRating,
  responseMs?: number | null,
): Grade {
  if (rating === STUDY_RATINGS.again) return Rating.Again;
  if (responseMs != null && responseMs >= HARD_RESPONSE_MS) return Rating.Hard;
  return Rating.Good;
}

const GRADE_LABELS: Record<number, FsrsReviewResult["fsrsRating"]> = {
  [Rating.Again]: "AGAIN",
  [Rating.Hard]: "HARD",
  [Rating.Good]: "GOOD",
  [Rating.Easy]: "EASY",
};

/**
 * FSRS replacement for calculateNextReview. Returns both the FSRS memory
 * state and the legacy fields (ease/streak keep evolving by the old rules
 * so the app can be rolled back to SM-2-lite without a data migration).
 */
export function calculateNextReviewFsrs(
  state: FsrsWordState,
  rating: StudyRating,
  options?: { now?: Date; responseMs?: number | null },
): FsrsReviewResult {
  const now = options?.now ?? new Date();
  const responseMs = options?.responseMs ?? null;
  const card = cardFromState(state, now);

  const stabilityBefore = state.reviewCount > 0 ? card.stability : null;
  const difficultyBefore = state.reviewCount > 0 ? card.difficulty : null;
  const retrievability =
    card.state === State.Review && card.last_review
      ? (engine.get_retrievability(card, now, false) as number)
      : null;
  const elapsedDays = state.lastReviewedAt
    ? Math.max(0, (now.getTime() - state.lastReviewedAt.getTime()) / DAY_MS)
    : 0;

  const grade = mapRatingToGrade(rating, responseMs);
  const next = engine.next(card, now, grade);

  // Legacy ease bookkeeping (same rules as studySrs.calculateNextReview)
  const currentEase = clamp(Math.round(state.reviewEase || 220), 130, 260);
  const reviewEase =
    rating === STUDY_RATINGS.again
      ? Math.max(130, currentEase - 20)
      : Math.min(260, currentEase + 5);

  if (rating === STUDY_RATINGS.again) {
    return {
      reviewIntervalDays: 0,
      reviewEase,
      reviewStreak: 0,
      nextReviewAt: new Date(now.getTime() + AGAIN_DELAY_MS),
      reviewStability: next.card.stability,
      reviewDifficulty: next.card.difficulty,
      scheduler: SCHEDULER_NAME,
      fsrsRating: GRADE_LABELS[grade],
      elapsedDays,
      retrievability,
      stabilityBefore,
      difficultyBefore,
      desiredRetention: DESIRED_RETENTION,
    };
  }

  const intervalDays = clamp(
    Math.max(1, next.card.scheduled_days),
    1,
    MAX_INTERVAL_DAYS,
  );

  return {
    reviewIntervalDays: intervalDays,
    reviewEase,
    reviewStreak: Math.max(0, state.reviewStreak) + 1,
    nextReviewAt: next.card.due,
    reviewStability: next.card.stability,
    reviewDifficulty: next.card.difficulty,
    scheduler: SCHEDULER_NAME,
    fsrsRating: GRADE_LABELS[grade],
    elapsedDays,
    retrievability,
    stabilityBefore,
    difficultyBefore,
    desiredRetention: DESIRED_RETENTION,
  };
}
