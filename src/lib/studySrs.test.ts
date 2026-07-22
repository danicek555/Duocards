import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateNextReview,
  calculateStudyStreak,
  getStartOfLocalDay,
  selectStudyQueue,
  STUDY_RATINGS,
} from "./studySrs";

const now = new Date("2026-07-21T12:00:00.000Z");

test("known cards move from one day to three days and then expand", () => {
  const first = calculateNextReview(
    { reviewIntervalDays: 0, reviewEase: 220, reviewStreak: 0 },
    STUDY_RATINGS.know,
    now,
  );
  assert.equal(first.reviewIntervalDays, 1);
  assert.equal(first.reviewEase, 225);
  assert.equal(first.reviewStreak, 1);
  assert.equal(first.nextReviewAt.toISOString(), "2026-07-22T12:00:00.000Z");

  const second = calculateNextReview(first, STUDY_RATINGS.know, now);
  assert.equal(second.reviewIntervalDays, 3);
  assert.equal(second.reviewStreak, 2);

  const third = calculateNextReview(second, STUDY_RATINGS.know, now);
  assert.equal(third.reviewIntervalDays, 7);
  assert.equal(third.reviewStreak, 3);
});

test("unknown cards return in ten minutes and reset their streak", () => {
  const next = calculateNextReview(
    { reviewIntervalDays: 20, reviewEase: 140, reviewStreak: 4 },
    STUDY_RATINGS.again,
    now,
  );
  assert.equal(next.reviewIntervalDays, 0);
  assert.equal(next.reviewEase, 130);
  assert.equal(next.reviewStreak, 0);
  assert.equal(next.nextReviewAt.toISOString(), "2026-07-21T12:10:00.000Z");
});

test("review intervals and ease stay inside their safety caps", () => {
  const next = calculateNextReview(
    { reviewIntervalDays: 179, reviewEase: 999, reviewStreak: 20 },
    STUDY_RATINGS.know,
    now,
  );
  assert.equal(next.reviewIntervalDays, 180);
  assert.equal(next.reviewEase, 260);
});

test("study queue prioritizes only cards that are due", () => {
  const queue = selectStudyQueue(
    [
      { id: 1, nextReviewAt: null },
      { id: 2, nextReviewAt: new Date("2026-07-21T11:00:00.000Z") },
      { id: 3, nextReviewAt: new Date("2026-07-22T12:00:00.000Z") },
    ],
    now,
  );
  assert.deepEqual(queue, {
    wordIds: [1, 2],
    dueWords: 2,
    isFullSet: false,
    isScheduledReview: true,
  });
});

test("a voluntary practice round includes the full set when nothing is due", () => {
  const queue = selectStudyQueue(
    [
      { id: 1, nextReviewAt: new Date("2026-07-22T12:00:00.000Z") },
      { id: 2, nextReviewAt: new Date("2026-07-23T12:00:00.000Z") },
    ],
    now,
  );
  assert.deepEqual(queue, {
    wordIds: [1, 2],
    dueWords: 0,
    isFullSet: true,
    isScheduledReview: false,
  });
});

test("local day boundaries respect the browser timezone offset", () => {
  assert.equal(
    getStartOfLocalDay(now, 360).toISOString(),
    "2026-07-21T06:00:00.000Z",
  );
  assert.equal(
    getStartOfLocalDay(now, -120).toISOString(),
    "2026-07-20T22:00:00.000Z",
  );
});

test("streak remains active when the latest review was yesterday", () => {
  const streak = calculateStudyStreak(
    [
      new Date("2026-07-18T17:00:00.000Z"),
      new Date("2026-07-19T17:00:00.000Z"),
      new Date("2026-07-20T17:00:00.000Z"),
    ],
    now,
    360,
  );
  assert.equal(streak, 3);
});
