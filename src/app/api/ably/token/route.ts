import { NextRequest, NextResponse } from "next/server";
import { Rest } from "ably";

const ABLY_API_KEY = process.env.ABLY_API_KEY;

// Room channels are the only channels clients may touch. Scoping the token to a
// single validated room channel stops a caller from subscribing to or
// publishing into other rooms with an otherwise unrestricted key.
const ROOM_CHANNEL_PATTERN = /^duocards-live-[A-Z0-9]{1,8}$/;

export async function GET(request: NextRequest) {
  if (!ABLY_API_KEY) {
    return NextResponse.json(
      { error: "ABLY_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedClientId = searchParams.get("clientId");
    const clientId = requestedClientId || `guest-${crypto.randomUUID()}`;

    const channel = searchParams.get("channel");
    if (!channel || !ROOM_CHANNEL_PATTERN.test(channel)) {
      return NextResponse.json(
        { error: "A valid live-game room channel is required." },
        { status: 400 }
      );
    }

    const ably = new Rest(ABLY_API_KEY);
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      // Legacy live game is peer-to-peer within a room, so a participant needs
      // to subscribe, publish and use presence — but only on this one channel.
      capability: JSON.stringify({
        [channel]: ["subscribe", "publish", "presence"],
      }),
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Ably token request failed:", error);
    return NextResponse.json(
      { error: "Failed to create Ably token request." },
      { status: 500 }
    );
  }
}
