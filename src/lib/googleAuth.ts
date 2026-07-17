import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getPublicAppUrl } from "@/lib/publicUrls";

export interface GoogleUserProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
}

export function isGoogleAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function getGoogleOAuthRedirectUri(requestOrigin: string): string {
  const appUrl = getPublicAppUrl();
  const base = appUrl || requestOrigin.replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function createOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Failed to exchange Google code",
    );
  }

  return { access_token: data.access_token };
}

export async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<GoogleUserProfile> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const data = (await response.json()) as GoogleUserProfile & {
    error?: { message?: string };
  };

  if (!response.ok || !data.sub || !data.email) {
    throw new Error(
      data.error?.message || "Failed to fetch Google user profile",
    );
  }

  return data;
}

function deriveNickname(profile: GoogleUserProfile, email: string): string {
  const raw =
    profile.given_name?.trim() ||
    profile.name?.trim().split(/\s+/)[0] ||
    email.split("@")[0] ||
    "User";
  return raw.slice(0, 50);
}

export async function findOrCreateGoogleUser(profile: GoogleUserProfile) {
  const email = profile.email.toLowerCase();

  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
    select: {
      id: true,
      email: true,
      password: true,
      nickname: true,
      createdAt: true,
    },
  });
  if (byGoogleId) return byGoogleId;

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
      nickname: true,
      createdAt: true,
      googleId: true,
    },
  });

  if (byEmail) {
    if (!byEmail.googleId) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.sub,
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          password: true,
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
      googleId: profile.sub,
      emailVerified: true,
    },
    select: {
      id: true,
      email: true,
      password: true,
      nickname: true,
      createdAt: true,
    },
  });
}
