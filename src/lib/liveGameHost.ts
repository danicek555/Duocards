/**
 * Guest / join-only live game on hostnames like live.duocards.xyz (first DNS label "live").
 * Middleware sets x-duocards-live-join-only for the live-game layout.
 *
 * Dev without DNS: set NEXT_PUBLIC_LIVE_JOIN_ONLY=true and open /live-game — join-only UI, no rewrite.
 */

/** True when hostname is the live guest subdomain (e.g. live.duocards.xyz, live.localhost). */
export function isLiveSubdomainHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0] ?? "";
  const first = h.split(".")[0];
  return first === "live";
}

/** Join-only mode: guest subdomain, or dev flag (any host). */
export function isJoinOnlyLiveMode(hostname: string): boolean {
  if (process.env.NEXT_PUBLIC_LIVE_JOIN_ONLY === "true") {
    return true;
  }
  return isLiveSubdomainHostname(hostname);
}

/** Client: guest live site (join only, no account). */
export function isJoinOnlyLiveBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return isJoinOnlyLiveMode(window.location.hostname);
}

/**
 * Public URL for the guest live subdomain. Set NEXT_PUBLIC_LIVE_GAME_GUEST_URL in production
 * if auto-derivation from NEXT_PUBLIC_APP_URL is wrong.
 */
export function getGuestLiveGameBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_LIVE_GAME_GUEST_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) {
    try {
      const u = new URL(app);
      const host = u.hostname.toLowerCase();
      if (host.startsWith("live.")) {
        return u.origin.replace(/\/$/, "");
      }
      const liveHost =
        host === "localhost" || host === "127.0.0.1"
          ? "live.localhost"
          : `live.${host}`;
      return `${u.protocol}//${liveHost}${u.port ? `:${u.port}` : ""}`.replace(
        /\/$/,
        "",
      );
    } catch {
      /* use default */
    }
  }

  return "https://live.duocards.xyz";
}
