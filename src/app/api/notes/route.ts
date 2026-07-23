import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_NOTE_LENGTH = 20000;

// GET - Fetch the caller's personal notes scratchpad.
// Every user has at most one Note row (userId is unique); an empty scratchpad
// is represented by a missing row and returned as empty content.
export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth")?.value;
  const payload = await verifyAuthToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await (prisma as any).note.findUnique({
      where: { userId: payload.userId },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json({
      content: note?.content ?? "",
      updatedAt: note?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Error loading notes:", error);
    return NextResponse.json(
      { error: "Failed to load notes", code: "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}

// PUT - Upsert the caller's notes scratchpad (last write wins).
// Autosave calls this frequently, so writes are rate limited per user.
export async function PUT(request: NextRequest) {
  const token = request.cookies.get("auth")?.value;
  const payload = await verifyAuthToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const limit = await checkRateLimit(
    `notes:put:user:${payload.userId}`,
    30,
    60 * 1000
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many saves, slow down.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "INVALID_REQUEST_FORMAT" },
      { status: 400 }
    );
  }

  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "Content must be a string", code: "INVALID_REQUEST_FORMAT" },
      { status: 400 }
    );
  }

  if (body.content.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: "Note is too long", code: "NOTE_TOO_LONG" },
      { status: 400 }
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await (prisma as any).note.upsert({
      where: { userId: payload.userId },
      create: { userId: payload.userId, content: body.content },
      update: { content: body.content },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json({
      content: note.content,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error("Error saving notes:", error);
    return NextResponse.json(
      { error: "Failed to save notes", code: "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
