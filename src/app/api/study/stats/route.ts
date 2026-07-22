import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudyStreak } from "@/lib/studySrs";
import {
  accuracyWindow,
  buildDailySeries,
  buildForecast,
  buildHeatmap,
  calibrationBins,
  hardestWords,
  memoryDistribution,
  perSetStats,
  responseTrend,
  MATURE_STABILITY_DAYS,
  STATS_HEATMAP_DAYS,
} from "@/lib/studyStats";

const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_WINDOW_DAYS = 400;

function parseTimezoneOffset(request: NextRequest) {
  const parsed = Number(request.headers.get("X-Timezone-Offset"));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(840, Math.max(-840, Math.round(parsed)));
}

// GET - aggregated study statistics for the stats dashboard panel
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyAuthToken(request.cookies.get("auth")?.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const timezoneOffsetMinutes = parseTimezoneOffset(request);
    const now = new Date();
    const heatmapStart = new Date(
      now.getTime() - (STATS_HEATMAP_DAYS + 1) * DAY_MS,
    );
    const streakStart = new Date(
      now.getTime() - STREAK_WINDOW_DAYS * DAY_MS,
    );

    const [reviews, streakDates, words, sets] = await Promise.all([
      prisma.studyReview.findMany({
        where: { userId: payload.userId, reviewedAt: { gte: heatmapStart } },
        select: {
          reviewedAt: true,
          rating: true,
          responseMs: true,
          retrievability: true,
          wordId: true,
        },
      }),
      prisma.studyReview.findMany({
        where: { userId: payload.userId, reviewedAt: { gte: streakStart } },
        select: { reviewedAt: true },
      }),
      prisma.word.findMany({
        where: { userId: payload.userId },
        select: {
          id: true,
          word: true,
          translation: true,
          flashcardSetId: true,
          reviewCount: true,
          correctReviewCount: true,
          lapseCount: true,
          reviewStability: true,
          reviewDifficulty: true,
          nextReviewAt: true,
          lastReviewedAt: true,
        },
      }),
      prisma.flashcardSet.findMany({
        where: { userId: payload.userId },
        select: { id: true, name: true },
      }),
    ]);

    const setNames = new Map(sets.map((set) => [set.id, set.name]));
    const accuracy7d = accuracyWindow(reviews, now, 7);
    const distribution = memoryDistribution(words);
    const dueNow = words.filter(
      (word) =>
        word.nextReviewAt && word.nextReviewAt.getTime() <= now.getTime(),
    ).length;
    const today = buildDailySeries(reviews, now, timezoneOffsetMinutes, 1)[0];

    return NextResponse.json({
      generatedAt: now.toISOString(),
      tiles: {
        streakDays: calculateStudyStreak(
          streakDates.map((row) => row.reviewedAt),
          now,
          timezoneOffsetMinutes,
        ),
        reviewsToday: today?.reviews ?? 0,
        dueToday: dueNow,
        accuracy7d: accuracy7d.accuracy,
        reviews7d: accuracy7d.reviews,
        totalWords: words.length,
        matureWords: distribution.mature,
        matureThresholdDays: MATURE_STABILITY_DAYS,
      },
      heatmap: buildHeatmap(reviews, now, timezoneOffsetMinutes),
      daily: buildDailySeries(reviews, now, timezoneOffsetMinutes),
      forecast: buildForecast(words, now, timezoneOffsetMinutes),
      memory: distribution,
      hardestWords: hardestWords(words).map((word) => ({
        ...word,
        setName:
          word.flashcardSetId != null
            ? (setNames.get(word.flashcardSetId) ?? null)
            : null,
      })),
      perSet: perSetStats(words, setNames, now),
      response: responseTrend(reviews, now),
      calibration: calibrationBins(reviews),
    });
  } catch (error) {
    console.error("Error building study stats:", error);
    return NextResponse.json(
      { error: "Failed to load study statistics" },
      { status: 500 },
    );
  }
}
