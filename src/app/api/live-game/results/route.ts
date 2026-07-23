import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

interface IncomingPlayer {
  name?: unknown;
  score?: unknown;
  correct?: unknown;
  total?: unknown;
  eliminated?: unknown;
}

function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

// POST - Save the results of a finished live game (called by the host client)
//
// Body: {
//   roomCode: string,
//   setName?: string,
//   startedAt?: string (ISO),
//   players: { name: string, score?: number, correct?: number, total?: number }[]
// }
//
// The winner is the player with the highest positive score. If no player has a
// score above zero (e.g. game modes that don't track scores yet), no winner is
// recorded. Only the authenticated host can save a game; it is always
// attributed to the caller.
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const roomCode =
      typeof body.roomCode === "string" ? body.roomCode.trim() : "";
    if (!roomCode) {
      return NextResponse.json(
        { error: "Room code is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.players) || body.players.length === 0) {
      return NextResponse.json(
        { error: "At least one player is required" },
        { status: 400 }
      );
    }

    const setName =
      typeof body.setName === "string" && body.setName.trim()
        ? body.setName.trim().slice(0, 200)
        : null;

    const modeId =
      typeof body.modeId === "string" && body.modeId.trim()
        ? body.modeId.trim().slice(0, 40)
        : null;

    let startedAt: Date | null = null;
    if (typeof body.startedAt === "string") {
      const parsed = new Date(body.startedAt);
      if (!Number.isNaN(parsed.getTime())) {
        startedAt = parsed;
      }
    }

    // Normalize players and find the winner (highest positive score).
    const players = (body.players as IncomingPlayer[]).map((p) => ({
      name:
        typeof p.name === "string" && p.name.trim()
          ? p.name.trim().slice(0, 64)
          : "Guest",
      score: toInt(p.score),
      correct: toInt(p.correct),
      total: toInt(p.total),
      eliminated: p.eliminated === true,
    }));

    // Survivors take precedence (survival mode): the winner is the highest
    // positive score among players who were not eliminated. Only when nobody
    // survived does the overall highest score win.
    const pickWinner = (pool: { score: number }[]) => {
      let index = -1;
      let best = 0;
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].score > best) {
          best = pool[i].score;
          index = i;
        }
      }
      return index;
    };
    const aliveIndexes = players
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => !p.eliminated);
    const aliveWinner = pickWinner(aliveIndexes.map(({ p }) => p));
    const winnerIndex =
      aliveWinner >= 0 ? aliveIndexes[aliveWinner].index : pickWinner(players);
    const winnerName = winnerIndex >= 0 ? players[winnerIndex].name : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).liveGame.create({
      data: {
        hostUserId: payload.userId,
        roomCode: roomCode.slice(0, 16),
        modeId,
        setName,
        totalPlayers: players.length,
        winnerName,
        startedAt,
        players: {
          create: players.map((p, index) => ({
            name: p.name,
            score: p.score,
            correct: p.correct,
            total: p.total,
            eliminated: p.eliminated,
            isWinner: index === winnerIndex,
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Error saving live game results:", error);
    return NextResponse.json(
      { error: "Failed to save live game results" },
      { status: 500 }
    );
  }
}

// GET - List the authenticated host's saved live games (most recent first)
//
// Query params: page (default 1), pageSize (default 20, max 50)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20)
    );

    const [total, games] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).liveGame.count({ where: { hostUserId: payload.userId } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).liveGame.findMany({
        where: { hostUserId: payload.userId },
        select: {
          id: true,
          roomCode: true,
          modeId: true,
          setName: true,
          totalPlayers: true,
          winnerName: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      items: games,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("Error listing live games:", error);
    return NextResponse.json(
      { error: "Failed to list live games" },
      { status: 500 }
    );
  }
}
