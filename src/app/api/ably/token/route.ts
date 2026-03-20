import { NextRequest, NextResponse } from "next/server";
import { Rest } from "ably";

const ABLY_API_KEY = process.env.ABLY_API_KEY;

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

    const ably = new Rest(ABLY_API_KEY);
    const tokenRequest = await ably.auth.createTokenRequest({ clientId });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Ably token request failed:", error);
    return NextResponse.json(
      { error: "Failed to create Ably token request." },
      { status: 500 }
    );
  }
}
