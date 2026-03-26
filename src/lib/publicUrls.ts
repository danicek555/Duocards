/**
 * Canonical public URLs — values come only from environment variables (no hardcoded domains,
 * no derivation). Set in .env / Vercel:
 *
 * - NEXT_PUBLIC_APP_URL — main site origin (no trailing slash), e.g. https://duocards.xyz
 * - NEXT_PUBLIC_LIVE_GAME_GUEST_URL — guest live origin (no trailing slash), e.g. https://live.duocards.xyz
 */

function trimOrigin(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\/$/, "");
}

export function getPublicAppUrl(): string {
  return trimOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

export function getGuestLiveGameBaseUrl(): string {
  return trimOrigin(process.env.NEXT_PUBLIC_LIVE_GAME_GUEST_URL);
}

/**
 * Client: link to the main app from the guest UI. When you use http://live.localhost:3000,
 * "Full DuoCards" should point at http://localhost:3000, not NEXT_PUBLIC_APP_URL (often a Vercel preview).
 * Production guest hosts still use env only.
 */
export function getPublicAppUrlForUi(): string {
  if (typeof window !== "undefined") {
    const h = window.location.hostname.toLowerCase();
    if (h === "live.localhost" || h === "live.127.0.0.1") {
      const port = window.location.port;
      const proto = window.location.protocol.replace(":", "");
      return trimOrigin(
        `${proto}://localhost${port ? `:${port}` : ""}`,
      );
    }
  }
  return getPublicAppUrl();
}
