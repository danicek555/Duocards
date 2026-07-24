import { NextRequest, NextResponse } from "next/server";
import { finishLiveSession } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// POST /api/live/sessions/:id/finish — host ends the game.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await finishLiveSession(
      id,
      request.headers.get("authorization"),
    );
    return NextResponse.json(result);
  } catch (error) {
    return liveErrorResponse(error);
  }
}
