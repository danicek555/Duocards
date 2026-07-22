import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { selectStudyQueue } from "@/lib/studySrs";

export async function POST(request: NextRequest) {
  try {
    const payload = await verifyAuthToken(request.cookies.get("auth")?.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { flashcardSetId?: unknown };
    const flashcardSetId = Number(body.flashcardSetId);
    if (!Number.isInteger(flashcardSetId) || flashcardSetId <= 0) {
      return NextResponse.json(
        { error: "Invalid flashcardSetId" },
        { status: 400 },
      );
    }

    const flashcardSet = await prisma.flashcardSet.findFirst({
      where: { id: flashcardSetId, userId: payload.userId },
      select: {
        id: true,
        words: {
          orderBy: { createdAt: "asc" },
          select: { id: true, nextReviewAt: true },
        },
      },
    });
    if (!flashcardSet) {
      return NextResponse.json(
        { error: "Flashcard set not found" },
        { status: 404 },
      );
    }
    if (flashcardSet.words.length === 0) {
      return NextResponse.json(
        { error: "The flashcard set is empty" },
        { status: 400 },
      );
    }

    const now = new Date();
    const { wordIds, dueWords, isFullSet, isScheduledReview } =
      selectStudyQueue(flashcardSet.words, now);

    const session = await prisma.studySession.create({
      data: {
        userId: payload.userId,
        flashcardSetId,
        wordIds,
        totalWords: wordIds.length,
        isFullSet,
        isScheduledReview,
      },
      select: { id: true, startedAt: true },
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        wordIds,
        totalWords: wordIds.length,
        dueWords,
        isFullSet,
        isScheduledReview,
        startedAt: session.startedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error starting study session:", error);
    return NextResponse.json(
      { error: "Failed to start study session" },
      { status: 500 },
    );
  }
}
