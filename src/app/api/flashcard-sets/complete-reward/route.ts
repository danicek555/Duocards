import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import {
  claimCompletionReward,
  CompletionRewardAlreadyClaimedError,
  CompletionRewardLimitError,
  FlashcardSetNotFoundError,
  StudySessionNotCompletedError,
} from "@/lib/coinEconomy";
import { prisma } from "@/lib/prisma";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

// POST - Award the server-calculated reward for completing a flashcard set.
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      flashcardSetId?: unknown;
      studySessionId?: unknown;
    };
    const flashcardSetId = body.flashcardSetId;
    if (!Number.isInteger(flashcardSetId) || Number(flashcardSetId) <= 0) {
      return NextResponse.json(
        { error: "Invalid flashcardSetId" },
        { status: 400 },
      );
    }
    if (
      typeof body.studySessionId !== "string" ||
      !isUuid(body.studySessionId)
    ) {
      return NextResponse.json(
        { error: "Invalid studySessionId" },
        { status: 400 },
      );
    }

    const result = await claimCompletionReward(prisma, {
      userId: payload.userId,
      flashcardSetId: Number(flashcardSetId),
      studySessionId: body.studySessionId,
    });

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CompletionRewardAlreadyClaimedError) {
      return NextResponse.json(
        { error: error.message, alreadyClaimed: true },
        { status: 400 },
      );
    }
    if (error instanceof CompletionRewardLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          limitType: error.limitType,
          remaining: error.remaining,
        },
        { status: 429 },
      );
    }
    if (error instanceof FlashcardSetNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StudySessionNotCompletedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Error awarding coins:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to award coins",
      },
      { status: 500 },
    );
  }
}
