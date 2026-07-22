export type LiveGameClientRole = "host" | "player";

function tokenKey(sessionId: string, role: LiveGameClientRole): string {
  return `duocards_live_v2:${role}:${sessionId}`;
}

export function saveLiveGameToken(
  sessionId: string,
  role: LiveGameClientRole,
  token: string,
): void {
  try {
    sessionStorage.setItem(tokenKey(sessionId, role), token);
  } catch {
    // The active page still keeps the token in memory when storage is blocked.
  }
}

export function readLiveGameToken(
  sessionId: string,
  role: LiveGameClientRole,
): string | null {
  try {
    return sessionStorage.getItem(tokenKey(sessionId, role));
  } catch {
    return null;
  }
}

export function clearLiveGameToken(
  sessionId: string,
  role: LiveGameClientRole,
): void {
  try {
    sessionStorage.removeItem(tokenKey(sessionId, role));
  } catch {
    // Nothing else is persisted.
  }
}
