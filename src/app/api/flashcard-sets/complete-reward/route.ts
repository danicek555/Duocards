import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { addCoins } from "@/lib/coins";
import { prisma } from "@/lib/prisma";

const MAX_COINS_PER_HOUR = 50;
const MAX_COINS_PER_DAY = 100;

// POST - Award coins for completing a flashcard set
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { flashcardSetId, rewardAmount } = body;

    if (!flashcardSetId || !rewardAmount) {
      return NextResponse.json(
        { error: "Missing flashcardSetId or rewardAmount" },
        { status: 400 }
      );
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get start of today (midnight) for checking same-day claims
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Check if this flashcard set was already claimed today
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todayClaimForSet = await (prisma as any).completionReward.findFirst({
      where: {
        userId: payload.userId,
        flashcardSetId: flashcardSetId,
        createdAt: {
          gte: startOfToday,
        },
      },
    });

    if (todayClaimForSet) {
      return NextResponse.json(
        {
          error: "You have already claimed the reward for this flashcard set today. Come back tomorrow!",
          alreadyClaimed: true,
        },
        { status: 400 }
      );
    }

    // Check hourly limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hourlyRewards = await (prisma as any).completionReward.aggregate({
      where: {
        userId: payload.userId,
        createdAt: {
          gte: oneHourAgo,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const hourlyTotal = hourlyRewards._sum.amount || 0;
    if (hourlyTotal + rewardAmount > MAX_COINS_PER_HOUR) {
      const remaining = MAX_COINS_PER_HOUR - hourlyTotal;
      return NextResponse.json(
        {
          error: `Hourly limit reached. You can earn ${remaining} more AI coins this hour. Maximum is ${MAX_COINS_PER_HOUR} AI coins per hour.`,
          limitType: "hourly",
          remaining,
        },
        { status: 429 }
      );
    }

    // Check daily limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dailyRewards = await (prisma as any).completionReward.aggregate({
      where: {
        userId: payload.userId,
        createdAt: {
          gte: oneDayAgo,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const dailyTotal = dailyRewards._sum.amount || 0;
    if (dailyTotal + rewardAmount > MAX_COINS_PER_DAY) {
      const remaining = MAX_COINS_PER_DAY - dailyTotal;
      return NextResponse.json(
        {
          error: `Daily limit reached. You can earn ${remaining} more AI coins today. Maximum is ${MAX_COINS_PER_DAY} AI coins per day.`,
          limitType: "daily",
          remaining,
        },
        { status: 429 }
      );
    }

    // Award coins and track the reward
    const newBalance = await addCoins(payload.userId, rewardAmount);

    // Record the completion reward
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).completionReward.create({
      data: {
        userId: payload.userId,
        amount: rewardAmount,
        flashcardSetId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        rewardAmount,
        newBalance,
        hourlyRemaining: MAX_COINS_PER_HOUR - (hourlyTotal + rewardAmount),
        dailyRemaining: MAX_COINS_PER_DAY - (dailyTotal + rewardAmount),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error awarding coins:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to award coins",
      },
      { status: 500 }
    );
  }
}
