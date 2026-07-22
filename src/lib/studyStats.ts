export const STATS_HEATMAP_DAYS = 105;
export const STATS_DAILY_DAYS = 30;
export const STATS_FORECAST_DAYS = 7;
export const MATURE_STABILITY_DAYS = 21;
export const YOUNG_STABILITY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatsReviewRow {
  reviewedAt: Date;
  rating: string;
  responseMs: number | null;
  retrievability: number | null;
}

export interface StatsWordRow {
  id: number;
  word: string;
  translation: string;
  flashcardSetId: number | null;
  reviewCount: number;
  correctReviewCount: number;
  lapseCount: number;
  reviewStability: number | null;
  reviewDifficulty: number | null;
  nextReviewAt: Date | null;
  lastReviewedAt: Date | null;
}

function clampOffset(timezoneOffsetMinutes: number) {
  return Math.min(840, Math.max(-840, Math.round(timezoneOffsetMinutes || 0)));
}

/** YYYY-MM-DD in the user's local timezone. */
export function localDateKey(date: Date, timezoneOffsetMinutes: number) {
  const offset = clampOffset(timezoneOffsetMinutes);
  return new Date(date.getTime() - offset * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Continuous per-day activity for the last `days` days (today included). */
export function buildHeatmap(
  reviews: StatsReviewRow[],
  now: Date,
  timezoneOffsetMinutes: number,
  days = STATS_HEATMAP_DAYS,
) {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    const key = localDateKey(review.reviewedAt, timezoneOffsetMinutes);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = localDateKey(now, timezoneOffsetMinutes);
  const series: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = shiftDateKey(today, -i);
    series.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return series;
}

/** Reviews and correct answers per local day for the last `days` days. */
export function buildDailySeries(
  reviews: StatsReviewRow[],
  now: Date,
  timezoneOffsetMinutes: number,
  days = STATS_DAILY_DAYS,
) {
  const byDay = new Map<string, { reviews: number; correct: number }>();
  for (const review of reviews) {
    const key = localDateKey(review.reviewedAt, timezoneOffsetMinutes);
    const entry = byDay.get(key) ?? { reviews: 0, correct: 0 };
    entry.reviews += 1;
    if (review.rating === "KNOW") entry.correct += 1;
    byDay.set(key, entry);
  }
  const today = localDateKey(now, timezoneOffsetMinutes);
  const series: { date: string; reviews: number; correct: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = shiftDateKey(today, -i);
    const entry = byDay.get(key) ?? { reviews: 0, correct: 0 };
    series.push({ date: key, ...entry });
  }
  return series;
}

/** Accuracy over a trailing window; null when there are no reviews. */
export function accuracyWindow(
  reviews: StatsReviewRow[],
  now: Date,
  days: number,
) {
  const since = now.getTime() - days * DAY_MS;
  let total = 0;
  let correct = 0;
  for (const review of reviews) {
    if (review.reviewedAt.getTime() < since) continue;
    total += 1;
    if (review.rating === "KNOW") correct += 1;
  }
  return {
    reviews: total,
    correct,
    accuracy: total > 0 ? correct / total : null,
  };
}

/**
 * Due-load forecast. Overdue words (including earlier today) count towards
 * today; upcoming days bucket by the user's local date.
 */
export function buildForecast(
  words: StatsWordRow[],
  now: Date,
  timezoneOffsetMinutes: number,
  days = STATS_FORECAST_DAYS,
) {
  const today = localDateKey(now, timezoneOffsetMinutes);
  const keys: string[] = [];
  for (let i = 0; i < days; i += 1) keys.push(shiftDateKey(today, i));
  const counts = new Map(keys.map((key) => [key, 0]));

  for (const word of words) {
    if (!word.nextReviewAt) continue;
    const key =
      word.nextReviewAt.getTime() <= now.getTime()
        ? today
        : localDateKey(word.nextReviewAt, timezoneOffsetMinutes);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((date) => ({ date, due: counts.get(date) ?? 0 }));
}

/** Buckets by FSRS stability: unseen / learning / young / mature. */
export function memoryDistribution(words: StatsWordRow[]) {
  const distribution = { unseen: 0, learning: 0, young: 0, mature: 0 };
  for (const word of words) {
    if (word.reviewCount <= 0) {
      distribution.unseen += 1;
    } else if (
      word.reviewStability == null ||
      word.reviewStability < YOUNG_STABILITY_DAYS
    ) {
      distribution.learning += 1;
    } else if (word.reviewStability < MATURE_STABILITY_DAYS) {
      distribution.young += 1;
    } else {
      distribution.mature += 1;
    }
  }
  return distribution;
}

/** Words the user keeps failing, hardest first. */
export function hardestWords(words: StatsWordRow[], limit = 10) {
  return words
    .filter((word) => word.reviewCount >= 3 && word.lapseCount > 0)
    .map((word) => ({
      id: word.id,
      word: word.word,
      translation: word.translation,
      flashcardSetId: word.flashcardSetId,
      lapses: word.lapseCount,
      reviews: word.reviewCount,
      accuracy:
        word.reviewCount > 0 ? word.correctReviewCount / word.reviewCount : 0,
      difficulty: word.reviewDifficulty,
      lapseRate: word.lapseCount / word.reviewCount,
    }))
    .sort(
      (a, b) =>
        b.lapseRate - a.lapseRate ||
        (b.difficulty ?? 0) - (a.difficulty ?? 0) ||
        b.lapses - a.lapses,
    )
    .slice(0, limit);
}

/** Lifetime per-set stats; sets without a single review sort last. */
export function perSetStats(
  words: StatsWordRow[],
  setNames: Map<number, string>,
  now: Date,
) {
  const bySet = new Map<
    number,
    {
      words: number;
      due: number;
      reviews: number;
      correct: number;
      lastStudiedAt: Date | null;
    }
  >();
  for (const word of words) {
    if (word.flashcardSetId == null) continue;
    const entry = bySet.get(word.flashcardSetId) ?? {
      words: 0,
      due: 0,
      reviews: 0,
      correct: 0,
      lastStudiedAt: null,
    };
    entry.words += 1;
    if (word.nextReviewAt && word.nextReviewAt.getTime() <= now.getTime()) {
      entry.due += 1;
    }
    entry.reviews += word.reviewCount;
    entry.correct += word.correctReviewCount;
    if (
      word.lastReviewedAt &&
      (!entry.lastStudiedAt || word.lastReviewedAt > entry.lastStudiedAt)
    ) {
      entry.lastStudiedAt = word.lastReviewedAt;
    }
    bySet.set(word.flashcardSetId, entry);
  }
  return Array.from(bySet.entries())
    .map(([setId, entry]) => ({
      setId,
      name: setNames.get(setId) ?? `#${setId}`,
      words: entry.words,
      due: entry.due,
      accuracy: entry.reviews > 0 ? entry.correct / entry.reviews : null,
      lastStudiedAt: entry.lastStudiedAt,
    }))
    .sort((a, b) => {
      const aTime = a.lastStudiedAt?.getTime() ?? 0;
      const bTime = b.lastStudiedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
}

/** Average response time for the last `days` days and the window before it. */
export function responseTrend(
  reviews: StatsReviewRow[],
  now: Date,
  days = 7,
) {
  const windowStart = now.getTime() - days * DAY_MS;
  const previousStart = now.getTime() - 2 * days * DAY_MS;
  let currentSum = 0;
  let currentCount = 0;
  let previousSum = 0;
  let previousCount = 0;
  for (const review of reviews) {
    if (review.responseMs == null) continue;
    const time = review.reviewedAt.getTime();
    if (time >= windowStart) {
      currentSum += review.responseMs;
      currentCount += 1;
    } else if (time >= previousStart) {
      previousSum += review.responseMs;
      previousCount += 1;
    }
  }
  return {
    avgMs: currentCount > 0 ? Math.round(currentSum / currentCount) : null,
    previousAvgMs:
      previousCount > 0 ? Math.round(previousSum / previousCount) : null,
  };
}

/**
 * Calibration of the scheduler: within each predicted-recall bin, how often
 * the user actually answered "know". Only reviews with a stored prediction
 * count (FSRS rows with elapsed history).
 */
export function calibrationBins(reviews: StatsReviewRow[]) {
  const edges = [0.5, 0.6, 0.7, 0.8, 0.9, 1.000001];
  const bins = edges.slice(0, -1).map((from, index) => ({
    from,
    to: Math.min(1, edges[index + 1]),
    count: 0,
    predictedSum: 0,
    correct: 0,
  }));
  for (const review of reviews) {
    if (review.retrievability == null) continue;
    const r = review.retrievability;
    const bin = bins.find((b) => r >= b.from && r < b.to);
    if (!bin) continue;
    bin.count += 1;
    bin.predictedSum += r;
    if (review.rating === "KNOW") bin.correct += 1;
  }
  return bins.map((bin) => ({
    from: bin.from,
    to: Math.min(1, bin.to),
    count: bin.count,
    predicted: bin.count > 0 ? bin.predictedSum / bin.count : null,
    actual: bin.count > 0 ? bin.correct / bin.count : null,
  }));
}
