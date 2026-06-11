import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import {
  isNewLocalDay,
  parseTimezoneOffsetHeader,
  secondsUntilNextLocalMidnight,
} from "@/lib/dailyReward";
import { prisma } from "@/lib/prisma";

const DAILY_REWARD_COINS = 100;

function getTimezoneOffset(request: NextRequest): number {
  return parseTimezoneOffsetHeader(
    request.headers.get("X-Timezone-Offset")
  );
}

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
    const tzOffset = getTimezoneOffset(request);
    const canClaim =
      !user.lastDailyReward ||
      isNewLocalDay(user.lastDailyReward, now, tzOffset);

    const timeUntilNextReward = canClaim
      ? 0
      : secondsUntilNextLocalMidnight(now, tzOffset);

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
    const tzOffset = getTimezoneOffset(request);
    const canClaim =
      !user.lastDailyReward ||
      isNewLocalDay(user.lastDailyReward, now, tzOffset);

    if (!canClaim) {
      const timeUntilNextReward = secondsUntilNextLocalMidnight(now, tzOffset);

      return NextResponse.json(
        {
          error: "Daily reward already claimed",
          timeUntilNextReward,
        },
        { status: 400 }
      );
    }

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
