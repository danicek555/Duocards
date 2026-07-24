import { NextRequest, NextResponse } from "next/server";
import { getLiveSession } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// GET /api/live/sessions/:id — reconnect snapshot (host/player bearer token).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await getLiveSession(id, request.headers.get("authorization"));
    return NextResponse.json(result);
  } catch (error) {
    return liveErrorResponse(error);
  }
}
