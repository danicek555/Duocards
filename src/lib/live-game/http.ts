import { NextResponse } from "next/server";
import { LiveApiError } from "./service";

/** Converts a service error into the same `{ error: { code, message } }`
 * envelope the shared backend uses, so the live-game client parses it the same
 * whether it hit Cloud Run or this internal fallback. */
export function liveErrorResponse(error: unknown): NextResponse {
  if (error instanceof LiveApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error("Live session route error:", error);
  return NextResponse.json(
    { error: { code: "LIVE_INTERNAL_ERROR", message: "Internal server error" } },
    { status: 500 },
  );
}
