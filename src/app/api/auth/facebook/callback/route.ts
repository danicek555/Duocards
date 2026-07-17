import { NextRequest, NextResponse } from "next/server";
import { createAuthToken } from "@/lib/auth";
import {
  exchangeFacebookCode,
  fetchFacebookUserProfile,
  findOrCreateFacebookUser,
  getFacebookOAuthRedirectUri,
  isFacebookAuthConfigured,
} from "@/lib/facebookAuth";

function redirectWithError(request: NextRequest, error: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isFacebookAuthConfigured()) {
    return redirectWithError(request, "facebook_not_configured");
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("facebook_oauth_state")?.value;
  const oauthError = searchParams.get("error");
  const oauthErrorDetail =
    searchParams.get("error_description") ||
    searchParams.get("error_message") ||
    "";

  if (oauthError) {
    if (
      oauthErrorDetail.toLowerCase().includes("invalid scopes") &&
      oauthErrorDetail.toLowerCase().includes("email")
    ) {
      return redirectWithError(request, "facebook_email_scope_not_enabled");
    }
    return redirectWithError(request, "facebook_auth_cancelled");
  }

  if (!code || !state || !storedState || state !== storedState) {
    return redirectWithError(request, "facebook_auth_failed");
  }

  try {
    const redirectUri = getFacebookOAuthRedirectUri(request.nextUrl.origin);
    const { access_token } = await exchangeFacebookCode(code, redirectUri);
    const profile = await fetchFacebookUserProfile(access_token);

    if (!profile.email) {
      return redirectWithError(request, "facebook_email_not_available");
    }

    const user = await findOrCreateFacebookUser(profile);
    const token = await createAuthToken(
      {
        userId: user.id,
        email: user.email,
      },
      user.password,
    );

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
    response.cookies.delete("facebook_oauth_state");
    return response;
  } catch (error) {
    console.error("Facebook OAuth callback error:", error);
    return redirectWithError(request, "facebook_auth_failed");
  }
}
