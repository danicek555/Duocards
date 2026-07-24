import { NextResponse } from "next/server";
import { checkRateLimit } from "./rateLimit";

// Per-user rate limit for paid AI endpoints. This is defence in depth on top of
// reserving coins before the external call: it caps how fast a single account
// can drive paid OpenAI traffic even while it still has a balance.
const AI_RATE_LIMIT = 20;
const AI_RATE_WINDOW_MS = 60_000;

/**
 * Enforces a per-user rate limit for a paid AI endpoint. Returns a 429 response
 * to return early when the limit is exceeded, or null when the request may
 * proceed. `bucket` separates limits per endpoint (e.g. "translate", "image").
 */
export async function enforceAiRateLimit(
  userId: number,
  bucket: string,
): Promise<NextResponse | null> {
  const { allowed, retryAfterSeconds } = await checkRateLimit(
    `ai:${bucket}:${userId}`,
    AI_RATE_LIMIT,
    AI_RATE_WINDOW_MS,
  );
  if (allowed) return null;
  return NextResponse.json(
    { error: "Too many AI requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
