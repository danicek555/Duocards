import { NextRequest, NextResponse } from "next/server";
import { createAuthToken } from "@/lib/auth";
import {
  exchangeGoogleCode,
  fetchGoogleUserProfile,
  findOrCreateGoogleUser,
  getGoogleOAuthRedirectUri,
  isGoogleAuthConfigured,
} from "@/lib/googleAuth";

function redirectWithError(request: NextRequest, error: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    return redirectWithError(request, "google_not_configured");
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("google_oauth_state")?.value;
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectWithError(request, "google_auth_cancelled");
  }

  if (!code || !state || !storedState || state !== storedState) {
    return redirectWithError(request, "google_auth_failed");
  }

  try {
    const redirectUri = getGoogleOAuthRedirectUri(request.nextUrl.origin);
    const { access_token } = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleUserProfile(access_token);

    if (!profile.email_verified) {
      return redirectWithError(request, "google_email_not_verified");
    }

    const user = await findOrCreateGoogleUser(profile);
    const token = await createAuthToken({
      userId: user.id,
      email: user.email,
    });

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";

    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.set("auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.delete("google_oauth_state");
    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return redirectWithError(request, "google_auth_failed");
  }
}
