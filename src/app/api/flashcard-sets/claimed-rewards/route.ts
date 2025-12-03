import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Get today's claimed rewards for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // Get start of today (midnight) for checking same-day claims
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Get all completion rewards claimed today
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todayRewards = await (prisma as any).completionReward.findMany({
      where: {
        userId: payload.userId,
        createdAt: {
          gte: startOfToday,
        },
      },
      select: {
        flashcardSetId: true,
        createdAt: true,
      },
    });

    // Return array of flashcard set IDs that were claimed today
    const claimedSetIds = todayRewards.map(
      (reward: { flashcardSetId: number }) => reward.flashcardSetId
    );

    return NextResponse.json(
      {
        claimedSetIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching claimed rewards:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch claimed rewards",
      },
      { status: 500 }
    );
  }
}
