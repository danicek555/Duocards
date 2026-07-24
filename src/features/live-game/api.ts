import { apiUrl, parseApiError } from "@/lib/apiUrl";
import type {
  CreateLiveGameSessionRequest,
  JoinLiveGameSessionRequest,
  LiveGameSessionSnapshot,
  SelectLiveGameTeamRequest,
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

// One fetch attempt with its own timeout controller, linked to the caller's
// abort signal so a fresh attempt is possible after a fallback.
async function liveFetchOnce(
  url: string,
  init: RequestInit,
  callerSignal: AbortSignal | null | undefined,
): Promise<{ response: Response; payload: unknown }> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = window.setTimeout(
    () => controller.abort(),
    LIVE_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    return { response, payload };
  } finally {
    window.clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

function internalLiveUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Calls the live game backend. Tries the shared backend (Cloud Run via
 * /shared-api) first and falls back to the built-in Next.js routes under
 * /api/live when the shared proxy is unavailable — a disabled /shared-api
 * proxy answers with a non-JSON 404, and gateways fail with 5xx. This keeps
 * live games working even when Cloud Run is switched off.
 */
async function liveRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const callerSignal = init.signal;
  const attemptInit: RequestInit = { ...init, headers };
  delete attemptInit.signal;

  const sharedUrl = apiUrl(path);
  const internalUrl = internalLiveUrl(path);

  let result: { response: Response; payload: unknown } | null = null;
  let sharedUnavailable = false;
  try {
    result = await liveFetchOnce(sharedUrl, attemptInit, callerSignal);
    const { response, payload } = result;
    const hasErrorEnvelope = !!(
      payload &&
      typeof payload === "object" &&
      "error" in (payload as Record<string, unknown>)
    );
    // 5xx gateway errors or a bare (non-JSON) 404 mean the shared backend is
    // not reachable; a JSON 404 is a real app response and must not fall back.
    if (
      !response.ok &&
      (response.status >= 500 || (response.status === 404 && !hasErrorEnvelope))
    ) {
      sharedUnavailable = true;
    }
  } catch (error) {
    if (callerSignal?.aborted) throw error;
    sharedUnavailable = true;
  }

  if (sharedUnavailable && internalUrl !== sharedUrl) {
    result = await liveFetchOnce(internalUrl, attemptInit, callerSignal);
  }
  if (!result) {
    throw new LiveGameApiError(
      0,
      "LIVE_TRANSPORT",
      "Live game request failed",
    );
  }

  const { response, payload } = result;
  if (!response.ok) {
    const parsed = parseApiError(payload, "Live game request failed");
    throw new LiveGameApiError(response.status, parsed.code, parsed.message);
  }
  return payload as T;
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

export function selectLiveTeam(
  sessionId: string,
  token: string,
  body: SelectLiveGameTeamRequest,
) {
  return liveRequest<LiveSessionResponse>(
    `/live/sessions/${encodeURIComponent(sessionId)}/team`,
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
