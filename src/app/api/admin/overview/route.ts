import { prisma } from "@/lib/prisma";
import { adminJson, requireAdminApi } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

interface DayCount {
  day: Date;
  count: bigint;
}

function serializeSeries(rows: DayCount[], days: number): { day: string; count: number }[] {
  const byDay = new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]),
  );
  const series: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day: date, count: byDay.get(date) ?? 0 });
  }
  return series;
}

// GET /api/admin/overview — aggregated read-only stats for the admin page.
export async function GET() {
  const guard = await requireAdminApi("overview");
  if ("response" in guard) return guard.response;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

  const [
    usersTotal,
    usersVerified,
    usersNewToday,
    usersNew7d,
    setsTotal,
    setsPublic,
    setsAi,
    wordsTotal,
    aiGenerationsToday,
    aiGenerations7d,
    coinsInPlay,
    coinSpent30d,
    coinEarned30d,
    studySessions7d,
    studyReviews7d,
    reviewAccuracy7d,
    liveGamesTotal,
    liveGames30d,
    livePlayersTotal,
    liveModes30d,
    liveActiveSessions,
    latestUsers,
    latestGames,
    registrationSeries,
    reviewSeries,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.flashcardSet.count(),
    prisma.flashcardSet.count({ where: { isPublic: true } }),
    prisma.flashcardSet.count({ where: { isAIGenerated: true } }),
    prisma.word.count(),
    prisma.aiGeneration.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.aiGeneration.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.aggregate({ _sum: { coins: true } }),
    prisma.coinTransaction.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: monthAgo }, amount: { lt: 0 } },
    }),
    prisma.coinTransaction.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: monthAgo }, amount: { gt: 0 } },
    }),
    prisma.studySession.count({ where: { startedAt: { gte: weekAgo } } }),
    prisma.studyReview.count({ where: { reviewedAt: { gte: weekAgo } } }),
    prisma.studySession.aggregate({
      _sum: { reviewCount: true, correctCount: true },
      where: { startedAt: { gte: weekAgo } },
    }),
    prisma.liveGame.count(),
    prisma.liveGame.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.liveGamePlayer.count(),
    prisma.liveGame.groupBy({
      by: ["modeId"],
      _count: { _all: true },
      where: { createdAt: { gte: monthAgo } },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.liveSession.count({
      where: { status: { not: "FINISHED" }, expiresAt: { gt: now } },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        email: true,
        locale: true,
        emailVerified: true,
        coins: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.liveGame.findMany({
      select: {
        id: true,
        roomCode: true,
        modeId: true,
        setName: true,
        totalPlayers: true,
        winnerName: true,
        endedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS count
      FROM "users"
      WHERE "createdAt" >= ${twoWeeksAgo}
      GROUP BY 1
    `,
    prisma.$queryRaw<DayCount[]>`
      SELECT date_trunc('day', "reviewedAt") AS day, count(*)::bigint AS count
      FROM "study_reviews"
      WHERE "reviewedAt" >= ${twoWeeksAgo}
      GROUP BY 1
    `,
  ]);

  const reviewTotals = reviewAccuracy7d._sum;
  const accuracy7d =
    reviewTotals.reviewCount && reviewTotals.reviewCount > 0
      ? Math.round(((reviewTotals.correctCount ?? 0) / reviewTotals.reviewCount) * 100)
      : null;

  return adminJson({
    generatedAt: now.toISOString(),
    users: {
      total: usersTotal,
      verified: usersVerified,
      newToday: usersNewToday,
      new7d: usersNew7d,
    },
    content: {
      sets: setsTotal,
      publicSets: setsPublic,
      aiSets: setsAi,
      words: wordsTotal,
    },
    coins: {
      inPlay: coinsInPlay._sum.coins ?? 0,
      spent30d: Math.abs(coinSpent30d._sum.amount ?? 0),
      earned30d: coinEarned30d._sum.amount ?? 0,
      aiGenerationsToday,
      aiGenerations7d,
    },
    study: {
      sessions7d: studySessions7d,
      reviews7d: studyReviews7d,
      accuracy7d,
    },
    live: {
      gamesTotal: liveGamesTotal,
      games30d: liveGames30d,
      playersTotal: livePlayersTotal,
      activeSessions: liveActiveSessions,
      topModes30d: liveModes30d.map((mode) => ({
        modeId: mode.modeId ?? "unknown",
        count: mode._count._all,
      })),
    },
    latestUsers,
    latestGames,
    series: {
      registrations14d: serializeSeries(registrationSeries, 14),
      reviews14d: serializeSeries(reviewSeries, 14),
    },
  });
}
