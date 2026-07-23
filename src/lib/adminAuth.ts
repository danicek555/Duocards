import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export interface AdminIdentity {
  userId: number;
  email: string;
  nickname: string;
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
