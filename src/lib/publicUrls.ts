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
