import "server-only";

import { NextRequest, NextResponse } from "next/server";

type SharedAuthPath = "/auth/register" | "/auth/verify" | "/auth/resend";

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "SHARED_BACKEND_UNAVAILABLE",
        message: "Registration service is temporarily unavailable.",
      },
    },
    { status: 503 },
  );
}

/**
 * Preserves old `/api/auth/*` URLs without creating a second identity flow.
 * Status 307 keeps the POST body while the browser follows the same-origin
 * `/shared-api` rewrite, including its cookies and trusted client-IP hop.
 */
export function redirectSharedAuthPost(
  request: NextRequest,
  path: SharedAuthPath,
): NextResponse {
  if (!process.env.SHARED_BACKEND_URL?.trim()) {
    return unavailableResponse();
  }

  const target = new URL(`/shared-api${path}`, request.url);
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
