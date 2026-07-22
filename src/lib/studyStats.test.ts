import assert from "node:assert/strict";
import test from "node:test";
import {
  accuracyWindow,
  buildDailySeries,
  buildForecast,
  buildHeatmap,
  calibrationBins,
  hardestWords,
  localDateKey,
  memoryDistribution,
  perSetStats,
  responseTrend,
  type StatsReviewRow,
  type StatsWordRow,
} from "./studyStats";

const now = new Date("2026-07-22T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function review(overrides: Partial<StatsReviewRow>): StatsReviewRow {
  return {
    reviewedAt: now,
    rating: "KNOW",
    responseMs: null,
    retrievability: null,
    ...overrides,
  };
}

function word(overrides: Partial<StatsWordRow>): StatsWordRow {
  return {
    id: 1,
    word: "casa",
    translation: "house",
    flashcardSetId: 1,
    reviewCount: 0,
    correctReviewCount: 0,
    lapseCount: 0,
    reviewStability: null,
    reviewDifficulty: null,
    nextReviewAt: null,
    lastReviewedAt: null,
    ...overrides,
  };
}

test("localDateKey respects the timezone offset", () => {
  const lateEvening = new Date("2026-07-22T23:30:00.000Z");
  assert.equal(localDateKey(lateEvening, 0), "2026-07-22");
  // UTC+2 (offset -120): 23:30 UTC is already the next local day
  assert.equal(localDateKey(lateEvening, -120), "2026-07-23");
});

test("heatmap covers every day and counts reviews per local day", () => {
  const series = buildHeatmap(
    [
      review({ wordId: 1, responseMs: 2000 }),
      review({ wordId: 1, rating: "AGAIN", responseMs: 4000 }),
      review({ reviewedAt: new Date(now.getTime() - DAY_MS), wordId: 2 }),
    ],
    now,
    0,
    7,
  );
  assert.equal(series.length, 7);
  assert.equal(series[6].count, 2);
  assert.equal(series[6].correct, 1);
  assert.equal(series[6].again, 1);
  assert.equal(series[6].uniqueWords, 1);
  assert.equal(series[6].avgMs, 3000);
  assert.equal(series[5].count, 1);
  assert.equal(series[5].avgMs, null);
  assert.equal(series[0].count, 0);
});

test("daily series splits correct answers", () => {
  const series = buildDailySeries(
    [review({}), review({ rating: "AGAIN" })],
    now,
    0,
    3,
  );
  assert.equal(series[2].reviews, 2);
  assert.equal(series[2].correct, 1);
});

test("accuracy window ignores older reviews and handles empty data", () => {
  const result = accuracyWindow(
    [
      review({}),
      review({ rating: "AGAIN" }),
      review({ reviewedAt: new Date(now.getTime() - 10 * DAY_MS) }),
    ],
    now,
    7,
  );
  assert.equal(result.reviews, 2);
  assert.equal(result.accuracy, 0.5);
  assert.equal(accuracyWindow([], now, 7).accuracy, null);
});

test("forecast puts overdue words into today and buckets future days", () => {
  const forecast = buildForecast(
    [
      word({ nextReviewAt: new Date(now.getTime() - 3 * DAY_MS) }),
      word({ id: 2, nextReviewAt: new Date(now.getTime() + 2 * DAY_MS) }),
      word({ id: 3, nextReviewAt: new Date(now.getTime() + 30 * DAY_MS) }),
      word({ id: 4 }),
    ],
    now,
    0,
  );
  assert.equal(forecast.length, 7);
  assert.equal(forecast[0].due, 1);
  assert.equal(forecast[2].due, 1);
  assert.equal(
    forecast.reduce((sum, day) => sum + day.due, 0),
    2,
  );
});

test("memory distribution buckets by stability", () => {
  const distribution = memoryDistribution([
    word({}),
    word({ id: 2, reviewCount: 2, reviewStability: 2 }),
    word({ id: 3, reviewCount: 5, reviewStability: 10 }),
    word({ id: 4, reviewCount: 9, reviewStability: 40 }),
    word({ id: 5, reviewCount: 3, reviewStability: null }),
  ]);
  assert.deepEqual(distribution, {
    unseen: 1,
    learning: 2,
    young: 1,
    mature: 1,
  });
});

test("hardest words require enough reviews and sort by lapse rate", () => {
  const result = hardestWords([
    word({ id: 1, reviewCount: 10, correctReviewCount: 5, lapseCount: 5 }),
    word({ id: 2, reviewCount: 10, correctReviewCount: 9, lapseCount: 1 }),
    word({ id: 3, reviewCount: 2, lapseCount: 2 }),
    word({ id: 4, reviewCount: 10, correctReviewCount: 10, lapseCount: 0 }),
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 1);
  assert.equal(result[0].accuracy, 0.5);
});

test("per-set stats aggregate accuracy, due counts and last study", () => {
  const names = new Map([
    [1, "Spanish"],
    [2, "German"],
  ]);
  const result = perSetStats(
    [
      word({
        id: 1,
        flashcardSetId: 1,
        reviewCount: 8,
        correctReviewCount: 6,
        nextReviewAt: new Date(now.getTime() - DAY_MS),
        lastReviewedAt: new Date(now.getTime() - DAY_MS),
      }),
      word({ id: 2, flashcardSetId: 1 }),
      word({ id: 3, flashcardSetId: 2, lastReviewedAt: now }),
      word({ id: 4, flashcardSetId: null }),
    ],
    names,
    now,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].setId, 2);
  assert.equal(result[1].words, 2);
  assert.equal(result[1].due, 1);
  assert.equal(result[1].accuracy, 0.75);
});

test("response trend compares current and previous week", () => {
  const trend = responseTrend(
    [
      review({ responseMs: 2000 }),
      review({ responseMs: 4000 }),
      review({
        responseMs: 8000,
        reviewedAt: new Date(now.getTime() - 10 * DAY_MS),
      }),
      review({ responseMs: null }),
    ],
    now,
  );
  assert.equal(trend.avgMs, 3000);
  assert.equal(trend.previousAvgMs, 8000);
});

test("calibration bins compare prediction with reality", () => {
  const bins = calibrationBins([
    review({ retrievability: 0.92, rating: "KNOW" }),
    review({ retrievability: 0.94, rating: "AGAIN" }),
    review({ retrievability: 0.72, rating: "KNOW" }),
    review({ retrievability: null }),
  ]);
  const top = bins[bins.length - 1];
  assert.equal(top.count, 2);
  assert.equal(top.actual, 0.5);
  assert.ok(top.predicted !== null && Math.abs(top.predicted - 0.93) < 1e-9);
  const seventies = bins.find((bin) => bin.from === 0.7);
  assert.equal(seventies?.count, 1);
  assert.equal(seventies?.actual, 1);
});
