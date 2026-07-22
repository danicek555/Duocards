import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import {
  isNewLocalDay,
  parseTimezoneOffsetHeader,
  secondsUntilNextLocalMidnight,
} from "@/lib/dailyReward";
import {
  claimDailyReward,
  DailyRewardAlreadyClaimedError,
  UserNotFoundError,
} from "@/lib/coinEconomy";
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

    const now = new Date();
    const tzOffset = getTimezoneOffset(request);
    const result = await claimDailyReward(prisma, {
      userId: payload.userId,
      amount: DAILY_REWARD_COINS,
      timezoneOffsetMinutes: tzOffset,
      now,
    });

    return NextResponse.json(
      {
        coins: result.coins,
        rewardAmount: DAILY_REWARD_COINS,
        lastDailyReward: result.lastDailyReward.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof DailyRewardAlreadyClaimedError) {
      const now = new Date();
      const tzOffset = getTimezoneOffset(request);
      return NextResponse.json(
        {
          error: error.message,
          timeUntilNextReward: secondsUntilNextLocalMidnight(now, tzOffset),
        },
        { status: 400 },
      );
    }
    if (error instanceof UserNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

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
