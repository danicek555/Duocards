/**
 * Guest / join-only live game on hostnames like live.duocards.xyz (first DNS label "live").
 * Middleware sets x-duocards-live-join-only for the live-game layout.
 *
 * Optional: NEXT_PUBLIC_LIVE_GAME_GUEST_URL, NEXT_PUBLIC_LIVE_GUEST_EXTRA_HOSTS
 * Dev: NEXT_PUBLIC_LIVE_JOIN_ONLY=true — join-only UI; use http://live.localhost:3000 for / rewrite.
 */

/** True when hostname is the live guest subdomain (e.g. live.duocards.xyz, live.localhost). */
export function isLiveSubdomainHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0] ?? "";
  const first = h.split(".")[0];
  return first === "live";
}

function hostnameFromGuestUrl(urlStr: string): string | null {
  try {
    const u = new URL(
      urlStr.includes("://") ? urlStr : `https://${urlStr.trim()}`,
    );
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Hosts that must never show app/page.tsx (login) at / — middleware + server guard use this.
 */
export function isGuestLiveHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0] ?? "";
  if (!h) return false;
  if (isLiveSubdomainHostname(h)) return true;

  const guestUrl = process.env.NEXT_PUBLIC_LIVE_GAME_GUEST_URL?.trim();
  if (guestUrl) {
    const gh = hostnameFromGuestUrl(guestUrl);
    if (gh && gh === h) return true;
  }

  const extra = process.env.NEXT_PUBLIC_LIVE_GUEST_EXTRA_HOSTS?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra?.includes(h)) return true;

  return false;
}

/**
 * Prefer Host, then forwarded chain (prefer live.* entry) — matches Edge middleware behavior.
 */
export function hostnameFromRequestHeaders(headers: Headers): string {
  const hostHeader = headers.get("host");
  if (hostHeader) {
    return hostHeader.split(":")[0]!.toLowerCase();
  }
  const forwarded = headers.get("x-forwarded-host");
  if (forwarded) {
    const candidates = forwarded.split(",").map((p) =>
      p.trim().split(":")[0]!.toLowerCase(),
    );
    const liveFirst = candidates.find(
      (x) => x.length > 0 && x.split(".")[0] === "live",
    );
    if (liveFirst) return liveFirst;
    const first = candidates[0];
    if (first) return first;
  }
  return "";
}

/** Join-only mode: guest hostname, or dev flag (any host). */
export function isJoinOnlyLiveMode(hostname: string): boolean {
  if (process.env.NEXT_PUBLIC_LIVE_JOIN_ONLY === "true") {
    return true;
  }
  return isGuestLiveHostname(hostname);
}

/** Client: guest live site (join only, no account). */
export function isJoinOnlyLiveBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return isJoinOnlyLiveMode(window.location.hostname);
}

export { getPublicAppUrl, getGuestLiveGameBaseUrl } from "./publicUrls";
