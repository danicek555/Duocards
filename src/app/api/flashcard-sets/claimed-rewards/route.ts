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
    // Completion rewards use a UTC claim date so every server instance agrees.
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    // Get all completion rewards claimed today
    const todayRewards = await prisma.completionReward.findMany({
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
    const claimedSetIds = todayRewards.map((reward) => reward.flashcardSetId);

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
