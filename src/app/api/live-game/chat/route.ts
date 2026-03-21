import { NextRequest, NextResponse } from "next/server";
import { Rest } from "ably";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { chatContainsBlockedContent } from "@/lib/chatContentFilter";

const ABLY_API_KEY = process.env.ABLY_API_KEY;
const MAX_MESSAGE_LENGTH = 200;

function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function channelNameForRoom(code: string): string {
  return `duocards-live-${normalizeRoomCode(code)}`;
}

/**
 * POST /api/live-game/chat
 * Rate-limited live room chat (1 message / minute per IP).
 * Publishes via Ably REST so clients still receive on the same channel/event.
 */
export async function POST(request: NextRequest) {
  if (!ABLY_API_KEY) {
    return NextResponse.json(
      { error: "Live chat is not configured." },
      { status: 500 },
    );
  }

  try {
    let body: { roomCode?: unknown; text?: unknown; from?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const roomCode =
      typeof body.roomCode === "string" ? body.roomCode.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const fromRaw = typeof body.from === "string" ? body.from.trim() : "";
    const from = fromRaw.length > 0 ? fromRaw.slice(0, 64) : "Guest";

    if (!roomCode || !text) {
      return NextResponse.json(
        { error: "Room code and message are required." },
        { status: 400 },
      );
    }

    const normalized = normalizeRoomCode(roomCode);
    if (normalized.length < 4) {
      return NextResponse.json(
        { error: "Invalid room code." },
        { status: 400 },
      );
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
        },
        { status: 400 },
      );
    }

    if (chatContainsBlockedContent(text, [])) {
      return NextResponse.json(
        {
          error:
            "Your message does not meet our community guidelines. Please revise and try again.",
        },
        { status: 400 },
      );
    }

    const clientIp = getClientIp(request);
    const limit = await checkRateLimit(
      `live-game-chat:ip:${clientIp}`,
      1,
      60 * 1000,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            "You can send at most one live chat message per minute. Please wait.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const channelName = channelNameForRoom(normalized);
    const ably = new Rest(ABLY_API_KEY);
    const channel = ably.channels.get(channelName);

    await channel.publish("chat-message", {
      from,
      text,
      at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Live game chat publish failed:", error);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 },
    );
  }
}
