import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminJson, requireAdminApi } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/users?query=&page=&pageSize= — searchable, paginated list.
export async function GET(request: NextRequest) {
  const guard = await requireAdminApi("users.list");
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20),
  );

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { nickname: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        email: true,
        locale: true,
        emailVerified: true,
        coins: true,
        createdAt: true,
        _count: {
          select: { flashcardSets: true, words: true, liveGames: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Role sloupec zatím není ve vygenerovaném Prisma klientu — donačíst raw.
  const ids = users.map((user) => user.id);
  const roles = ids.length
    ? await prisma.$queryRaw<{ id: number; role: string }[]>`
        SELECT "id", "role" FROM "users" WHERE "id" = ANY(${ids})
      `
    : [];
  const roleById = new Map(roles.map((row) => [row.id, row.role]));

  return adminJson({
    items: users.map((user) => ({
      ...user,
      role: roleById.get(user.id) ?? "USER",
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
