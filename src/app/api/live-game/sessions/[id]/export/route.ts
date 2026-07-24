import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// Escapes a value for CSV (quotes, commas, newlines) per RFC 4180.
function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * Detailed teacher export of a live game as CSV (opens in Excel). One row per
 * player answer: round, question, correct answer, who answered, what they
 * answered, whether it was correct, points and response time. Only the host of
 * the session may download it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await (prisma as any).liveSession.findFirst({
      where: { id, hostUserId: payload.userId },
      select: {
        id: true,
        roomCode: true,
        modeId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        participants: {
          select: {
            id: true,
            nickname: true,
            team: true,
            score: true,
            correct: true,
            total: true,
            bestStreak: true,
          },
          orderBy: { score: "desc" },
        },
        rounds: {
          select: {
            sequence: true,
            prompt: true,
            correctAnswer: true,
            answers: {
              select: {
                participantId: true,
                answer: true,
                isCorrect: true,
                points: true,
                responseTimeMs: true,
                createdAt: true,
              },
            },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nameById = new Map<string, { nickname: string; team: string | null }>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.participants as any[]).map((p) => [
        p.id,
        { nickname: p.nickname, team: p.team },
      ]),
    );

    const lines: string[] = [];

    // Summary header block.
    lines.push(csvRow(["DuoCards live game export"]));
    lines.push(csvRow(["Room code", session.roomCode]));
    lines.push(csvRow(["Mode", session.modeId]));
    lines.push(csvRow(["Status", session.status]));
    lines.push(
      csvRow([
        "Started",
        session.startedAt ? new Date(session.startedAt).toISOString() : "",
      ]),
    );
    lines.push(
      csvRow([
        "Ended",
        session.endedAt ? new Date(session.endedAt).toISOString() : "",
      ]),
    );
    lines.push("");

    // Final standings.
    lines.push(csvRow(["Standings"]));
    lines.push(
      csvRow(["Rank", "Player", "Team", "Score", "Correct", "Total", "Accuracy %", "Best streak"]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session.participants as any[]).forEach((p, index) => {
      lines.push(
        csvRow([
          index + 1,
          p.nickname,
          p.team ?? "",
          p.score,
          p.correct,
          p.total,
          p.total > 0 ? Math.round((p.correct / p.total) * 100) : "",
          p.bestStreak,
        ]),
      );
    });
    lines.push("");

    // Per-answer detail: one row per player answer, grouped by question.
    lines.push(csvRow(["Answers by question"]));
    lines.push(
      csvRow([
        "Round",
        "Question",
        "Correct answer",
        "Player",
        "Team",
        "Player answer",
        "Correct?",
        "Points",
        "Response time (s)",
      ]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session.rounds as any[]).forEach((round) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const answers = round.answers as any[];
      if (answers.length === 0) {
        lines.push(
          csvRow([round.sequence, round.prompt, round.correctAnswer, "", "", "", "", "", ""]),
        );
        return;
      }
      answers.forEach((a) => {
        const who = nameById.get(a.participantId);
        lines.push(
          csvRow([
            round.sequence,
            round.prompt,
            round.correctAnswer,
            who?.nickname ?? a.participantId,
            who?.team ?? "",
            a.answer,
            a.isCorrect ? "yes" : "no",
            a.points,
            (a.responseTimeMs / 1000).toFixed(2),
          ]),
        );
      });
    });

    // UTF-8 BOM so Excel renders diacritics correctly.
    const csv = "﻿" + lines.join("\r\n") + "\r\n";
    const filename = `duocards-live-${session.roomCode || session.id}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error exporting live game:", error);
    return NextResponse.json(
      { error: "Failed to export live game" },
      { status: 500 },
    );
  }
}
