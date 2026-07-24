import { NextRequest, NextResponse } from "next/server";
import { leaveLiveSession } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// POST /api/live/sessions/:id/leave — player leaves the session.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await leaveLiveSession(id, request.headers.get("authorization"));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return liveErrorResponse(error);
  }
}
