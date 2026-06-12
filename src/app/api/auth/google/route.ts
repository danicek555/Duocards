import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  getGoogleOAuthRedirectUri,
  isGoogleAuthConfigured,
} from "@/lib/googleAuth";

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(url);
  }

  const state = createOAuthState();
  const redirectUri = getGoogleOAuthRedirectUri(request.nextUrl.origin);
  const authUrl = buildGoogleAuthUrl(state, redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
