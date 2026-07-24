import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { createLiveSession } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// POST /api/live/sessions — create a session (host, authenticated by cookie).
export async function POST(request: NextRequest) {
  try {
    const payload = await verifyAuthToken(request.cookies.get("auth")?.value);
    if (!payload) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }
    const body = await request.json();
    const result = await createLiveSession(payload.userId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return liveErrorResponse(error);
  }
}
