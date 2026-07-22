import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateStudyStreak,
  getStartOfLocalDay,
  STUDY_RATINGS,
} from "@/lib/studySrs";

function getTimezoneOffset(request: NextRequest) {
  const value = Number(request.headers.get("x-timezone-offset") ?? 0);
  return Number.isFinite(value) ? Math.min(840, Math.max(-840, value)) : 0;
}

export async function GET(request: NextRequest) {
  try {
    const payload = await verifyAuthToken(request.cookies.get("auth")?.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const timezoneOffset = getTimezoneOffset(request);
    const startOfToday = getStartOfLocalDay(now, timezoneOffset);
    const streakWindowStart = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

    const [dueWords, todayReviews, recentReviewDates, masteredWords, totalReviews] =
      await Promise.all([
        prisma.word.findMany({
          where: {
            userId: payload.userId,
            flashcardSetId: { not: null },
            OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }],
          },
          select: { flashcardSetId: true },
        }),
        prisma.studyReview.findMany({
          where: { userId: payload.userId, reviewedAt: { gte: startOfToday } },
          select: { rating: true },
        }),
        prisma.studyReview.findMany({
          where: {
            userId: payload.userId,
            reviewedAt: { gte: streakWindowStart },
          },
          orderBy: { reviewedAt: "desc" },
          take: 5000,
          select: { reviewedAt: true },
        }),
        prisma.word.count({
          where: {
            userId: payload.userId,
            OR: [{ reviewStreak: { gte: 3 } }, { reviewIntervalDays: { gte: 7 } }],
          },
        }),
        prisma.studyReview.count({ where: { userId: payload.userId } }),
      ]);

    const correctToday = todayReviews.filter(
      (review) => review.rating === STUDY_RATINGS.know,
    ).length;
    const dueBySet = dueWords.reduce<Record<string, number>>((counts, word) => {
      if (word.flashcardSetId !== null) {
        const key = String(word.flashcardSetId);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    }, {});

    return NextResponse.json({
      dueToday: dueWords.length,
      dueBySet,
      reviewedToday: todayReviews.length,
      correctToday,
      accuracyToday:
        todayReviews.length === 0
          ? 0
          : Math.round((correctToday / todayReviews.length) * 100),
      streakDays: calculateStudyStreak(
        recentReviewDates.map((review) => review.reviewedAt),
        now,
        timezoneOffset,
      ),
      masteredWords,
      totalReviews,
    });
  } catch (error) {
    console.error("Error fetching study summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch study summary" },
      { status: 500 },
    );
  }
}
