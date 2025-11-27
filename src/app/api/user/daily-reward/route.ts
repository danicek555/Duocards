import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DAILY_REWARD_COINS = 100;

// GET - Check if user can claim daily reward and get time until next reward
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { lastDailyReward: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const canClaim =
      !user.lastDailyReward || isNewDay(user.lastDailyReward, now);

    let timeUntilNextReward = 0;
    if (!canClaim && user.lastDailyReward) {
      const nextRewardTime = getNextRewardTime(user.lastDailyReward);
      timeUntilNextReward = Math.max(
        0,
        Math.floor((nextRewardTime.getTime() - now.getTime()) / 1000)
      );
    }

    return NextResponse.json(
      {
        canClaim,
        timeUntilNextReward,
        lastClaimed: user.lastDailyReward?.toISOString() || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking daily reward:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check daily reward",
      },
      { status: 500 }
    );
  }
}

// POST - Claim daily reward
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { lastDailyReward: true, coins: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const canClaim =
      !user.lastDailyReward || isNewDay(user.lastDailyReward, now);

    if (!canClaim) {
      const nextRewardTime = getNextRewardTime(user.lastDailyReward!);
      const timeUntilNextReward = Math.max(
        0,
        Math.floor((nextRewardTime.getTime() - now.getTime()) / 1000)
      );

      return NextResponse.json(
        {
          error: "Daily reward already claimed",
          timeUntilNextReward,
        },
        { status: 400 }
      );
    }

    // Update user with new coins and lastDailyReward timestamp
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        coins: {
          increment: DAILY_REWARD_COINS,
        },
        lastDailyReward: now,
      },
      select: {
        coins: true,
        lastDailyReward: true,
      },
    });

    return NextResponse.json(
      {
        coins: updatedUser.coins,
        rewardAmount: DAILY_REWARD_COINS,
        lastDailyReward:
          updatedUser.lastDailyReward?.toISOString() || undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error claiming daily reward:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to claim daily reward",
      },
      { status: 500 }
    );
  }
}

// Helper function to check if it's a new day
// Note: Client-side will calculate based on user's local timezone for display
// Server just checks if enough time has passed (24 hours minimum)
function isNewDay(lastClaim: Date, now: Date): boolean {
  // Check if at least 24 hours have passed
  const hoursSinceLastClaim =
    (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastClaim >= 24;
}

// Helper function to get next reward time
// Note: Client will calculate based on local midnight for accurate display
function getNextRewardTime(lastClaim: Date): Date {
  // Return 24 hours after last claim (client will calculate local midnight)
  return new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
}
