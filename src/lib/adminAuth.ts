import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export interface AdminIdentity {
  userId: number;
  email: string;
  nickname: string;
}

/**
 * Sliding-window rate limit for admin APIs: per admin, in-memory. Serverless
 * instances each keep their own window, which is fine — the goal is to slow
 * scripted abuse of a stolen session, not precise accounting.
 */
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateWindows = new Map<number, number[]>();

function isRateLimited(userId: number): boolean {
  const now = Date.now();
  const hits = (rateWindows.get(userId) ?? []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS,
  );
  hits.push(now);
  rateWindows.set(userId, hits);
  return hits.length > RATE_LIMIT_MAX;
}

/**
 * Resolves the signed-in user and requires the ADMIN role. Returns null for
 * anonymous users, non-admins and unknown accounts — callers decide whether
 * to redirect (pages) or return 403 (API).
 *
 * The role is read with a raw query so this file does not depend on a
 * freshly generated Prisma client (the column is added by migration
 * 20260723090000_user_role).
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get("auth")?.value;
  const payload = await verifyAuthToken(token);
  if (!payload) return null;

  const rows = await prisma.$queryRaw<
    { id: number; email: string; nickname: string; role: string }[]
  >`SELECT "id", "email", "nickname", "role" FROM "users" WHERE "id" = ${payload.userId} LIMIT 1`;
  const user = rows[0];
  if (!user || user.role !== "ADMIN") return null;
  return { userId: user.id, email: user.email, nickname: user.nickname };
}

/** Fire-and-forget audit trail of admin actions. Never blocks the response. */
export function auditAdminAction(
  adminUserId: number,
  action: string,
  detail?: string,
): void {
  void prisma
    .$executeRaw`INSERT INTO "admin_audit_log" ("adminUserId", "action", "detail") VALUES (${adminUserId}, ${action.slice(0, 64)}, ${detail ? detail.slice(0, 256) : null})`.catch(
    (error) => {
      console.error("admin audit write failed:", error);
    },
  );
}

/**
 * Guard for admin API routes: 403 for non-admins, 429 above the rate limit,
 * audit entry for every allowed request.
 */
export async function requireAdminApi(
  action: string,
  detail?: string,
): Promise<{ admin: AdminIdentity } | { response: NextResponse }> {
  const admin = await getAdminIdentity();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  if (isRateLimited(admin.userId)) {
    return {
      response: NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    };
  }
  auditAdminAction(admin.userId, action, detail);
  return { admin };
}

/** Cache-defeating headers for every admin payload. */
export function adminJson(payload: unknown, status = 200): NextResponse {
  const response = NextResponse.json(payload, { status });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
