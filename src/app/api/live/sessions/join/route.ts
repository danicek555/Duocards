import { NextRequest, NextResponse } from "next/server";
import { joinLiveSession } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// POST /api/live/sessions/join — join by room code (guest, no account).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await joinLiveSession(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return liveErrorResponse(error);
  }
}
