import { NextRequest, NextResponse } from "next/server";
import { startLiveSession } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// POST /api/live/sessions/:id/start — host opens the first round.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await startLiveSession(
      id,
      request.headers.get("authorization"),
    );
    return NextResponse.json(result);
  } catch (error) {
    return liveErrorResponse(error);
  }
}
