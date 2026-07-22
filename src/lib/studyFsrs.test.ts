import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateNextReviewFsrs,
  seedCardFromLegacy,
  mapRatingToGrade,
  HARD_RESPONSE_MS,
  DESIRED_RETENTION,
  SCHEDULER_NAME,
  type FsrsWordState,
} from "./studyFsrs";
import { STUDY_RATINGS } from "./studySrs";
import { Rating } from "ts-fsrs";

const now = new Date("2026-07-22T12:00:00.000Z");

function freshWord(overrides: Partial<FsrsWordState> = {}): FsrsWordState {
  return {
    reviewIntervalDays: 0,
    reviewEase: 220,
    reviewStreak: 0,
    reviewCount: 0,
    lapseCount: 0,
    reviewStability: null,
    reviewDifficulty: null,
    lastReviewedAt: null,
    nextReviewAt: null,
    ...overrides,
  };
}

test("first KNOW schedules at least one day ahead with FSRS state", () => {
  const next = calculateNextReviewFsrs(freshWord(), STUDY_RATINGS.know, { now });
  assert.ok(next.reviewIntervalDays >= 1);
  assert.ok(next.nextReviewAt.getTime() > now.getTime());
  assert.ok(next.reviewStability > 0);
  assert.ok(next.reviewDifficulty >= 1 && next.reviewDifficulty <= 10);
  assert.equal(next.reviewStreak, 1);
  assert.equal(next.scheduler, SCHEDULER_NAME);
  assert.equal(next.fsrsRating, "GOOD");
  assert.equal(next.desiredRetention, DESIRED_RETENTION);
  assert.equal(next.stabilityBefore, null);
});

test("AGAIN keeps the ten-minute relearn loop and records a lapse state", () => {
  const next = calculateNextReviewFsrs(freshWord(), STUDY_RATINGS.again, { now });
  assert.equal(next.reviewIntervalDays, 0);
  assert.equal(next.reviewStreak, 0);
  assert.equal(next.nextReviewAt.getTime(), now.getTime() + 10 * 60 * 1000);
  assert.equal(next.fsrsRating, "AGAIN");
  assert.equal(next.reviewEase, 200);
});

test("slow KNOW maps to Hard and schedules shorter than fast KNOW", () => {
  assert.equal(mapRatingToGrade(STUDY_RATINGS.know, 1_000), Rating.Good);
  assert.equal(
    mapRatingToGrade(STUDY_RATINGS.know, HARD_RESPONSE_MS),
    Rating.Hard,
  );
  assert.equal(mapRatingToGrade(STUDY_RATINGS.again, 1_000), Rating.Again);

  const fast = calculateNextReviewFsrs(freshWord(), STUDY_RATINGS.know, {
    now,
    responseMs: 1_500,
  });
  const slow = calculateNextReviewFsrs(freshWord(), STUDY_RATINGS.know, {
    now,
    responseMs: 15_000,
  });
  assert.equal(slow.fsrsRating, "HARD");
  assert.ok(slow.reviewStability < fast.reviewStability);
});

test("repeated KNOW keeps growing the interval", () => {
  let state = freshWord();
  let reviewAt = now;
  let previousInterval = 0;
  for (let i = 0; i < 4; i += 1) {
    const next = calculateNextReviewFsrs(state, STUDY_RATINGS.know, {
      now: reviewAt,
    });
    assert.ok(
      next.reviewIntervalDays >= previousInterval,
      `interval should not shrink (step ${i})`,
    );
    previousInterval = next.reviewIntervalDays;
    state = {
      ...state,
      reviewIntervalDays: next.reviewIntervalDays,
      reviewEase: next.reviewEase,
      reviewStreak: next.reviewStreak,
      reviewCount: state.reviewCount + 1,
      reviewStability: next.reviewStability,
      reviewDifficulty: next.reviewDifficulty,
      lastReviewedAt: reviewAt,
      nextReviewAt: next.nextReviewAt,
    };
    reviewAt = next.nextReviewAt;
  }
  assert.ok(previousInterval >= 3);
});

test("lapse on a mature card does not reset stability to zero", () => {
  const mature = freshWord({
    reviewIntervalDays: 60,
    reviewStreak: 6,
    reviewCount: 6,
    reviewStability: 60,
    reviewDifficulty: 4,
    lastReviewedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
    nextReviewAt: now,
  });
  const next = calculateNextReviewFsrs(mature, STUDY_RATINGS.again, { now });
  assert.ok(next.reviewStability > 0.1);
  assert.ok(next.reviewStability < 60);
  assert.ok(next.retrievability !== null && next.retrievability > 0);
  assert.equal(next.stabilityBefore, 60);
});

test("legacy words are seeded from interval and ease", () => {
  const legacy = freshWord({
    reviewIntervalDays: 30,
    reviewEase: 220,
    reviewStreak: 5,
    reviewCount: 5,
    lastReviewedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    nextReviewAt: now,
  });
  const card = seedCardFromLegacy(legacy, now);
  assert.equal(card.stability, 30);
  assert.ok(card.difficulty > 1 && card.difficulty < 10);

  const next = calculateNextReviewFsrs(legacy, STUDY_RATINGS.know, { now });
  // A known 30-day card should keep a comparable or longer interval.
  assert.ok(next.reviewIntervalDays >= 20);
  assert.ok(next.elapsedDays > 29 && next.elapsedDays < 31);
});

test("never-reviewed word seeds as a brand-new card", () => {
  const card = seedCardFromLegacy(freshWord(), now);
  assert.equal(card.reps, 0);
  assert.equal(card.stability, 0);
});
