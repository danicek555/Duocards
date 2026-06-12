import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getPublicAppUrl } from "@/lib/publicUrls";
import { createOAuthState } from "@/lib/googleAuth";

const FACEBOOK_API_VERSION = "v21.0";

export interface FacebookUserProfile {
  id: string;
  email?: string;
  name?: string;
}

export function isFacebookAuthConfigured(): boolean {
  return !!(
    process.env.FACEBOOK_APP_ID?.trim() &&
    process.env.FACEBOOK_APP_SECRET?.trim()
  );
}

export function getFacebookOAuthRedirectUri(requestOrigin: string): string {
  const appUrl = getPublicAppUrl();
  const base = appUrl || requestOrigin.replace(/\/$/, "");
  return `${base}/api/auth/facebook/callback`;
}

export function buildFacebookAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: redirectUri,
    state,
    scope: "email,public_profile",
    response_type: "code",
  });
  return `https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth?${params.toString()}`;
}

export { createOAuthState };

export async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string }> {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token?${params.toString()}`,
  );

  const data = (await response.json()) as {
    access_token?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error?.message || "Failed to exchange Facebook code",
    );
  }

  return { access_token: data.access_token };
}

export async function fetchFacebookUserProfile(
  accessToken: string,
): Promise<FacebookUserProfile> {
  const params = new URLSearchParams({
    fields: "id,name,email",
    access_token: accessToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me?${params.toString()}`,
  );

  const data = (await response.json()) as FacebookUserProfile & {
    error?: { message?: string };
  };

  if (!response.ok || !data.id) {
    throw new Error(
      data.error?.message || "Failed to fetch Facebook user profile",
    );
  }

  return data;
}

function deriveNickname(profile: FacebookUserProfile, email: string): string {
  const raw =
    profile.name?.trim().split(/\s+/)[0] ||
    email.split("@")[0] ||
    "User";
  return raw.slice(0, 50);
}

export async function findOrCreateFacebookUser(profile: FacebookUserProfile) {
  if (!profile.email) {
    throw new Error("Facebook account has no email");
  }

  const email = profile.email.toLowerCase();

  const byFacebookId = await prisma.user.findUnique({
    where: { facebookId: profile.id },
    select: {
      id: true,
      email: true,
      nickname: true,
      createdAt: true,
    },
  });
  if (byFacebookId) return byFacebookId;

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      nickname: true,
      createdAt: true,
      facebookId: true,
    },
  });

  if (byEmail) {
    if (!byEmail.facebookId) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          facebookId: profile.id,
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          createdAt: true,
        },
      });
    }
    return byEmail;
  }

  const password = await hashPassword(randomBytes(48).toString("hex"));

  return prisma.user.create({
    data: {
      email,
      password,
      nickname: deriveNickname(profile, email),
      facebookId: profile.id,
      emailVerified: true,
    },
    select: {
      id: true,
      email: true,
      nickname: true,
      createdAt: true,
    },
  });
}
