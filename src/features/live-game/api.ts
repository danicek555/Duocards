import { apiUrl, parseApiError } from "@/lib/apiUrl";
import type {
  CreateLiveGameSessionRequest,
  JoinLiveGameSessionRequest,
  LiveGameSessionSnapshot,
  SubmitLiveGameAnswerRequest,
} from "./contracts";

const LIVE_REQUEST_TIMEOUT_MS = 8_000;

export class LiveGameApiError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "LiveGameApiError";
    this.status = status;
    this.code = code;
  }
}

interface LiveSessionResponse {
  session: LiveGameSessionSnapshot;
}

export interface CreateLiveSessionResponse extends LiveSessionResponse {
  hostToken: string;
}

export interface JoinLiveSessionResponse extends LiveSessionResponse {
  participant: { id: string; nickname: string };
  playerToken: string;
}

export interface SubmitLiveAnswerResponse extends LiveSessionResponse {
  answer: { accepted: true; correct: boolean; points: number };
}

async function liveRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = window.setTimeout(
    () => controller.abort(),
    LIVE_REQUEST_TIMEOUT_MS,
  );

  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const parsed = parseApiError(payload, "Live game request failed");
      throw new LiveGameApiError(response.status, parsed.code, parsed.message);
    }
    return payload as T;
  } finally {
    window.clearTimeout(timer);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function createLiveSession(body: CreateLiveGameSessionRequest) {
  return liveRequest<CreateLiveSessionResponse>("/live/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function joinLiveSession(body: JoinLiveGameSessionRequest) {
  return liveRequest<JoinLiveSessionResponse>("/live/sessions/join", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getLiveSession(
  sessionId: string,
  token: string,
  signal?: AbortSignal,
) {
  return liveRequest<LiveSessionResponse>(
    `/live/sessions/${encodeURIComponent(sessionId)}`,
    { signal },
    token,
  );
}

export function startLiveSession(sessionId: string, token: string) {
  return liveRequest<LiveSessionResponse>(
    `/live/sessions/${encodeURIComponent(sessionId)}/start`,
    { method: "POST" },
    token,
  );
}

export function submitLiveAnswer(
  sessionId: string,
  token: string,
  body: SubmitLiveGameAnswerRequest,
) {
  return liveRequest<SubmitLiveAnswerResponse>(
    `/live/sessions/${encodeURIComponent(sessionId)}/answers`,
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

export function advanceLiveSession(sessionId: string, token: string) {
  return liveRequest<LiveSessionResponse>(
    `/live/sessions/${encodeURIComponent(sessionId)}/advance`,
    { method: "POST" },
    token,
  );
}

export function finishLiveSession(sessionId: string, token: string) {
  return liveRequest<LiveSessionResponse>(
    `/live/sessions/${encodeURIComponent(sessionId)}/finish`,
    { method: "POST" },
    token,
  );
}

export function leaveLiveSession(sessionId: string, token: string) {
  return liveRequest<void>(
    `/live/sessions/${encodeURIComponent(sessionId)}/leave`,
    { method: "POST" },
    token,
  );
}
