import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Fetch a single saved live game (with players) owned by the caller
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const gameId = parseInt(id, 10);
    if (Number.isNaN(gameId)) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const game = await (prisma as any).liveGame.findFirst({
      where: { id: gameId, hostUserId: payload.userId },
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
        players: {
          select: {
            id: true,
            name: true,
            score: true,
            correct: true,
            total: true,
            isWinner: true,
          },
          orderBy: { score: "desc" },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Attach a derived accuracy percentage for each player for convenience.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players = (game.players as any[]).map((p) => ({
      ...p,
      accuracy: p.total > 0 ? Math.round((p.correct / p.total) * 100) : null,
    }));

    return NextResponse.json({ game: { ...game, players } });
  } catch (error) {
    console.error("Error fetching live game:", error);
    return NextResponse.json(
      { error: "Failed to fetch live game" },
      { status: 500 }
    );
  }
}
