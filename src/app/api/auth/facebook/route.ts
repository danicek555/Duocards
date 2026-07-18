import { NextRequest, NextResponse } from "next/server";
import {
  buildFacebookAuthUrl,
  createOAuthState,
  getFacebookOAuthRedirectUri,
  isFacebookAuthConfigured,
} from "@/lib/facebookAuth";
import { OAUTH_REMEMBER_COOKIE_NAME } from "@/lib/authSession";

export async function GET(request: NextRequest) {
  if (!isFacebookAuthConfigured()) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", "facebook_not_configured");
    return NextResponse.redirect(url);
  }

  const state = createOAuthState();
  const redirectUri = getFacebookOAuthRedirectUri(request.nextUrl.origin);
  const authUrl = buildFacebookAuthUrl(state, redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("facebook_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set(
    OAUTH_REMEMBER_COOKIE_NAME,
    request.nextUrl.searchParams.get("rememberMe") === "true" ? "1" : "0",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    },
  );

  return response;
}
