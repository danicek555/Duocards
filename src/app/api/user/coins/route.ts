import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { getCoins } from "@/lib/coins";

// GET - Get user's current coin balance
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coins = await getCoins(payload.userId);

    return NextResponse.json({ coins }, { status: 200 });
  } catch (error) {
    console.error("Error fetching coins:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch coins",
      },
      { status: 500 }
    );
  }
}

