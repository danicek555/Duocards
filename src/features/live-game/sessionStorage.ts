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
    sessionStorage.removeItem(metaKey(sessionId));
    sessionStorage.removeItem(resultsSavedKey(sessionId));
  } catch {
    // Nothing else is persisted.
  }
}

/**
 * Metadata the host needs at the end of the game (results persistence) that
 * the session snapshot does not carry. Survives a page reload in the tab.
 */
export interface LiveGameSessionMeta {
  setName: string | null;
  startedAt: string | null;
}

function metaKey(sessionId: string): string {
  return `duocards_live_v2_meta:${sessionId}`;
}

function resultsSavedKey(sessionId: string): string {
  return `duocards_live_v2_saved:${sessionId}`;
}

export function saveLiveGameMeta(
  sessionId: string,
  meta: LiveGameSessionMeta,
): void {
  try {
    sessionStorage.setItem(metaKey(sessionId), JSON.stringify(meta));
  } catch {
    // Results are still saved without the optional metadata.
  }
}

export function readLiveGameMeta(sessionId: string): LiveGameSessionMeta {
  try {
    const raw = sessionStorage.getItem(metaKey(sessionId));
    if (!raw) return { setName: null, startedAt: null };
    const parsed = JSON.parse(raw) as Partial<LiveGameSessionMeta>;
    return {
      setName: typeof parsed.setName === "string" ? parsed.setName : null,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
    };
  } catch {
    return { setName: null, startedAt: null };
  }
}

/** Idempotency guard so a finished game is stored only once per tab. */
export function markLiveGameResultsSaved(sessionId: string): boolean {
  try {
    if (sessionStorage.getItem(resultsSavedKey(sessionId))) return false;
    sessionStorage.setItem(resultsSavedKey(sessionId), "1");
    return true;
  } catch {
    return true;
  }
}
