import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STUDY_RATINGS } from "@/lib/studySrs";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await verifyAuthToken(request.cookies.get("auth")?.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }
    const session = await prisma.studySession.findFirst({
      where: { id, userId: payload.userId },
      select: {
        id: true,
        totalWords: true,
        wordIds: true,
        isFullSet: true,
        completedAt: true,
      },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Study session not found" },
        { status: 404 },
      );
    }
    if (session.completedAt) {
      return NextResponse.json({
        completed: true,
        completedAt: session.completedAt,
        isFullSet: session.isFullSet,
      });
    }

    const knownWords = await prisma.studyReview.findMany({
      where: {
        sessionId: id,
        rating: STUDY_RATINGS.know,
        wordId: { in: session.wordIds },
      },
      distinct: ["wordId"],
      select: { wordId: true },
    });
    if (knownWords.length < session.totalWords) {
      return NextResponse.json(
        {
          error: "Every card must be known before completing the session",
          knownWords: knownWords.length,
          totalWords: session.totalWords,
        },
        { status: 409 },
      );
    }

    const completedAt = new Date();
    await prisma.studySession.update({
      where: { id },
      data: { completedAt },
    });
    return NextResponse.json({
      completed: true,
      completedAt,
      isFullSet: session.isFullSet,
    });
  } catch (error) {
    console.error("Error completing study session:", error);
    return NextResponse.json(
      { error: "Failed to complete study session" },
      { status: 500 },
    );
  }
}
