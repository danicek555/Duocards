import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminJson, requireAdminApi } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/users/:id — full read-only profile of one account.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return adminJson({ error: "Invalid user ID" }, 400);
  }

  const guard = await requireAdminApi("users.detail", `userId=${userId}`);
  if ("response" in guard) return guard.response;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [user, roleRows, sets, coinTransactions, studySessions, studyReviews7d, liveGamesHosted] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nickname: true,
          email: true,
          locale: true,
          emailVerified: true,
          coins: true,
          createdAt: true,
          updatedAt: true,
          lastDailyReward: true,
          googleId: true,
          facebookId: true,
        },
      }),
      prisma.$queryRaw<{ role: string }[]>`
        SELECT "role" FROM "users" WHERE "id" = ${userId} LIMIT 1
      `,
      prisma.flashcardSet.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          isPublic: true,
          isAIGenerated: true,
          publicCode: true,
          createdAt: true,
          _count: { select: { words: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.coinTransaction.findMany({
        where: { userId },
        select: {
          id: true,
          amount: true,
          balanceAfter: true,
          type: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.studySession.count({ where: { userId } }),
      prisma.studyReview.count({
        where: { userId, reviewedAt: { gte: weekAgo } },
      }),
      prisma.liveGame.count({ where: { hostUserId: userId } }),
    ]);

  if (!user) {
    return adminJson({ error: "User not found" }, 404);
  }

  return adminJson({
    user: {
      ...user,
      role: roleRows[0]?.role ?? "USER",
      // Expose only the presence of OAuth links, never the provider ids.
      hasGoogle: Boolean(user.googleId),
      hasFacebook: Boolean(user.facebookId),
      googleId: undefined,
      facebookId: undefined,
    },
    sets,
    coinTransactions,
    stats: {
      studySessions,
      studyReviews7d,
      liveGamesHosted,
    },
  });
}
