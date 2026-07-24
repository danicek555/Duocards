import { NextRequest, NextResponse } from "next/server";
import { submitLiveAnswer } from "@/lib/live-game/service";
import { liveErrorResponse } from "@/lib/live-game/http";

// POST /api/live/sessions/:id/answers — player submits an answer (idempotent).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await submitLiveAnswer(
      id,
      request.headers.get("authorization"),
      body,
    );
    const { created, ...payload } = result as {
      created?: boolean;
      answer: unknown;
      session: unknown;
    };
    return NextResponse.json(payload, { status: created ? 201 : 200 });
  } catch (error) {
    return liveErrorResponse(error);
  }
}
