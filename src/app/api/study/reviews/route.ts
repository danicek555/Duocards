import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STUDY_RATINGS, type StudyRating } from "@/lib/studySrs";
import { calculateNextReviewFsrs } from "@/lib/studyFsrs";

interface ReviewBody {
  sessionId?: unknown;
  wordId?: unknown;
  rating?: unknown;
  idempotencyKey?: unknown;
  responseMs?: unknown;
}

const MAX_RESPONSE_MS = 10 * 60 * 1000;

function parseResponseMs(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(Math.round(parsed), MAX_RESPONSE_MS);
}

function prismaErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function reviewResponse(review: {
  id: string;
  sessionId: string;
  userId: number;
  wordId: number;
  rating: string;
  intervalAfterDays: number;
  easeAfter: number;
  nextReviewAt: Date;
  reviewedAt: Date;
}) {
  return {
    reviewId: review.id,
    sessionId: review.sessionId,
    wordId: review.wordId,
    rating: review.rating,
    intervalDays: review.intervalAfterDays,
    ease: review.easeAfter,
    nextReviewAt: review.nextReviewAt,
    reviewedAt: review.reviewedAt,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await verifyAuthToken(request.cookies.get("auth")?.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ReviewBody;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const wordId = Number(body.wordId);
    const rating = body.rating;
    const idempotencyKey =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const responseMs = parseResponseMs(body.responseMs);
    if (
      !isUuid(sessionId) ||
      !Number.isInteger(wordId) ||
      wordId <= 0 ||
      (rating !== STUDY_RATINGS.know && rating !== STUDY_RATINGS.again) ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 64
    ) {
      return NextResponse.json({ error: "Invalid review" }, { status: 400 });
    }

    const existing = await prisma.studyReview.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (
        existing.userId !== payload.userId ||
        existing.sessionId !== sessionId ||
        existing.wordId !== wordId
      ) {
        return NextResponse.json(
          { error: "Idempotency key already used" },
          { status: 409 },
        );
      }
      return NextResponse.json(reviewResponse(existing));
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const review = await prisma.$transaction(
          async (transaction) => {
            const session = await transaction.studySession.findFirst({
              where: {
                id: sessionId,
                userId: payload.userId,
                completedAt: null,
              },
              select: { flashcardSetId: true, wordIds: true },
            });
            if (!session) throw new Error("STUDY_SESSION_NOT_FOUND");
            if (!session.wordIds.includes(wordId)) {
              throw new Error("WORD_NOT_IN_STUDY_SESSION");
            }

            const word = await transaction.word.findFirst({
              where: {
                id: wordId,
                userId: payload.userId,
                flashcardSetId: session.flashcardSetId,
              },
              select: {
                reviewIntervalDays: true,
                reviewEase: true,
                reviewStreak: true,
                reviewCount: true,
                lapseCount: true,
                reviewStability: true,
                reviewDifficulty: true,
                lastReviewedAt: true,
                nextReviewAt: true,
              },
            });
            if (!word) throw new Error("WORD_NOT_FOUND");

            const now = new Date();
            const next = calculateNextReviewFsrs(word, rating as StudyRating, {
              now,
              responseMs,
            });
            const created = await transaction.studyReview.create({
              data: {
                sessionId,
                userId: payload.userId,
                wordId,
                flashcardSetId: session.flashcardSetId,
                idempotencyKey,
                rating,
                intervalBeforeDays: word.reviewIntervalDays,
                intervalAfterDays: next.reviewIntervalDays,
                easeAfter: next.reviewEase,
                nextReviewAt: next.nextReviewAt,
                reviewedAt: now,
                scheduler: next.scheduler,
                fsrsRating: next.fsrsRating,
                responseMs,
                elapsedDays: next.elapsedDays,
                retrievability: next.retrievability,
                stabilityBefore: next.stabilityBefore,
                stabilityAfter: next.reviewStability,
                difficultyBefore: next.difficultyBefore,
                difficultyAfter: next.reviewDifficulty,
                desiredRetention: next.desiredRetention,
              },
            });

            await transaction.word.update({
              where: { id: wordId },
              data: {
                reviewIntervalDays: next.reviewIntervalDays,
                reviewEase: next.reviewEase,
                reviewStreak: next.reviewStreak,
                reviewStability: next.reviewStability,
                reviewDifficulty: next.reviewDifficulty,
                reviewCount: { increment: 1 },
                correctReviewCount:
                  rating === STUDY_RATINGS.know ? { increment: 1 } : undefined,
                lapseCount:
                  rating === STUDY_RATINGS.again ? { increment: 1 } : undefined,
                lastReviewedAt: now,
                nextReviewAt: next.nextReviewAt,
              },
            });
            await transaction.studySession.update({
              where: { id: sessionId },
              data: {
                reviewCount: { increment: 1 },
                correctCount:
                  rating === STUDY_RATINGS.know ? { increment: 1 } : undefined,
              },
            });
            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return NextResponse.json(reviewResponse(review), { status: 201 });
      } catch (error) {
        const code = prismaErrorCode(error);
        if (code === "P2034" && attempt < 2) continue;
        if (code === "P2002") {
          const duplicate = await prisma.studyReview.findUnique({
            where: { idempotencyKey },
          });
          if (
            duplicate &&
            duplicate.userId === payload.userId &&
            duplicate.sessionId === sessionId &&
            duplicate.wordId === wordId
          ) {
            return NextResponse.json(reviewResponse(duplicate));
          }
          return NextResponse.json(
            { error: "Idempotency key already used" },
            { status: 409 },
          );
        }
        if (error instanceof Error) {
          if (error.message === "STUDY_SESSION_NOT_FOUND") {
            return NextResponse.json(
              { error: "Study session not found or already completed" },
              { status: 404 },
            );
          }
          if (
            error.message === "WORD_NOT_IN_STUDY_SESSION" ||
            error.message === "WORD_NOT_FOUND"
          ) {
            return NextResponse.json(
              { error: "Word does not belong to this study session" },
              { status: 400 },
            );
          }
        }
        throw error;
      }
    }

    return NextResponse.json(
      { error: "Could not save review" },
      { status: 409 },
    );
  } catch (error) {
    console.error("Error saving study review:", error);
    return NextResponse.json(
      { error: "Failed to save study review" },
      { status: 500 },
    );
  }
}
