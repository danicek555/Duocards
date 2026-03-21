import { NextRequest } from "next/server";
import { createClient } from "redis";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();
let redisClient: ReturnType<typeof createClient> | null = null;
let redisInitAttempted = false;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null;
}

async function getRedisClient(): Promise<ReturnType<typeof createClient> | null> {
  if (redisClient) return redisClient;
  if (redisInitAttempted) return null;
  redisInitAttempted = true;

  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  try {
    const client = createClient({ url: redisUrl });
    client.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });
    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (error) {
    console.error("Failed to initialize Redis client:", error);
    return null;
  }
}

function nowMs(): number {
  return Date.now();
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const redis = await getRedisClient();
  if (redis) {
    const redisKey = `rate_limit:${key}`;
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    try {
      const current = await redis.incr(redisKey);
      if (current === 1) {
        await redis.expire(redisKey, ttlSeconds);
      }

      if (current > limit) {
        const ttl = await redis.ttl(redisKey);
        return {
          allowed: false,
          retryAfterSeconds: ttl > 0 ? ttl : ttlSeconds,
        };
      }

      return { allowed: true, retryAfterSeconds: 0 };
    } catch (error) {
      console.error("Redis rate limit failed, falling back to memory:", error);
    }
  }

  const now = nowMs();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  store.set(key, existing);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** After profanity / blocked content on AI or live chat — block both for this window. */
const CONTENT_VIOLATION_WINDOW_MS = 5 * 60 * 1000;

const contentBlockMemory = new Map<string, number>();

function contentViolationKeys(ip: string, userId: number | null): string[] {
  const keys = [`cv:ip:${ip}`];
  if (userId != null) keys.push(`cv:user:${userId}`);
  return keys;
}

async function getSingleContentBlockStatus(
  innerKey: string
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const redisKey = `content_block:${innerKey}`;
  const redis = await getRedisClient();
  if (redis) {
    try {
      const ttl = await redis.ttl(redisKey);
      if (ttl > 0) {
        return { blocked: true, retryAfterSeconds: ttl };
      }
      return { blocked: false, retryAfterSeconds: 0 };
    } catch (error) {
      console.error("Redis content block read failed, using memory:", error);
    }
  }

  const until = contentBlockMemory.get(redisKey);
  const now = nowMs();
  if (!until || until <= now) {
    contentBlockMemory.delete(redisKey);
    return { blocked: false, retryAfterSeconds: 0 };
  }
  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)),
  };
}

async function setSingleContentBlock(innerKey: string, windowMs: number) {
  const redisKey = `content_block:${innerKey}`;
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.setEx(redisKey, ttlSeconds, "1");
      return;
    } catch (error) {
      console.error("Redis content block set failed, using memory:", error);
    }
  }
  contentBlockMemory.set(redisKey, nowMs() + windowMs);
}

/**
 * True if this IP or user is in the post-violation cooldown (AI + live chat).
 */
export async function isContentViolationBlocked(
  request: NextRequest,
  userId: number | null
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const ip = getClientIp(request);
  let maxRetry = 0;
  for (const inner of contentViolationKeys(ip, userId)) {
    const s = await getSingleContentBlockStatus(inner);
    if (s.blocked && s.retryAfterSeconds > maxRetry) {
      maxRetry = s.retryAfterSeconds;
    }
  }
  if (maxRetry > 0) {
    return { blocked: true, retryAfterSeconds: maxRetry };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

/** Call when a message fails the profanity filter (starts 5-minute cooldown). */
export async function setContentViolationBlock(
  request: NextRequest,
  userId: number | null
): Promise<void> {
  const ip = getClientIp(request);
  for (const inner of contentViolationKeys(ip, userId)) {
    await setSingleContentBlock(inner, CONTENT_VIOLATION_WINDOW_MS);
  }
}
