const legacyApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api";

const sharedApiBaseUrl =
  process.env.NEXT_PUBLIC_SHARED_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? "/shared-api" : legacyApiBaseUrl);

const sharedHealthUrl =
  process.env.NEXT_PUBLIC_SHARED_HEALTH_URL?.trim() || "/shared-health";

const primaryTimeoutMs = 8_000;
const healthCacheMs = 20_000;
const circuitBreakerMs = 30_000;

let cloudUnavailableUntil = 0;
let lastHealthyAt = 0;
let healthCheck: Promise<boolean> | null = null;

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Builds a URL for endpoints already available on the shared backend.
 *
 * Production defaults to the same-origin /shared-api proxy. Local development
 * continues to use the existing API base unless explicitly configured.
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimTrailingSlashes(sharedApiBaseUrl)}${normalizedPath}`;
}

function legacyApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimTrailingSlashes(legacyApiBaseUrl)}${normalizedPath}`;
}

function isCloudCircuitOpen(): boolean {
  return Date.now() < cloudUnavailableUntil;
}

function markCloudUnavailable(): void {
  cloudUnavailableUntil = Date.now() + circuitBreakerMs;
  lastHealthyAt = 0;
}

function markCloudHealthy(): void {
  cloudUnavailableUntil = 0;
  lastHealthyAt = Date.now();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let abortedByCaller = false;
  const abortFromCaller = () => {
    abortedByCaller = true;
    controller.abort(init.signal?.reason);
  };

  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (abortedByCaller) throw error;
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function cloudIsHealthy(init: RequestInit): Promise<boolean> {
  if (isCloudCircuitOpen()) return false;
  if (Date.now() - lastHealthyAt < healthCacheMs) return true;
  if (healthCheck) return healthCheck;

  healthCheck = (async () => {
    try {
      const response = await fetchWithTimeout(
        sharedHealthUrl,
        {
          credentials: init.credentials ?? "include",
          cache: "no-store",
          signal: init.signal,
        },
        primaryTimeoutMs,
      );
      if (!response.ok) {
        markCloudUnavailable();
        return false;
      }
      markCloudHealthy();
      return true;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      markCloudUnavailable();
      return false;
    } finally {
      healthCheck = null;
    }
  })();

  return healthCheck;
}

function requestMethod(init: RequestInit): string {
  return (init.method || "GET").toUpperCase();
}

function isReadOnlyMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function shouldFallbackFromResponse(
  response: Response,
  method: string,
): boolean {
  if (isReadOnlyMethod(method)) return response.status >= 500;
  return [502, 503, 504].includes(response.status);
}

function fetchLegacy(path: string, init: RequestInit): Promise<Response> {
  return fetch(legacyApiUrl(path), {
    ...init,
    credentials: init.credentials ?? "include",
  });
}

/**
 * Fetches a migrated API endpoint and includes cookies across origins by
 * default. Callers can still override the credentials mode explicitly.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const requestInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? "include",
  };
  const method = requestMethod(requestInit);

  if (trimTrailingSlashes(sharedApiBaseUrl) === trimTrailingSlashes(legacyApiBaseUrl)) {
    return fetchLegacy(path, requestInit);
  }

  // Check Cloud Run before writes. This avoids sending the same mutation to
  // both backends when a request times out after the database was updated.
  if (!isReadOnlyMethod(method) && !(await cloudIsHealthy(requestInit))) {
    return fetchLegacy(path, requestInit);
  }

  if (isCloudCircuitOpen()) return fetchLegacy(path, requestInit);

  try {
    const response = await fetchWithTimeout(
      apiUrl(path),
      requestInit,
      primaryTimeoutMs,
    );
    if (!shouldFallbackFromResponse(response, method)) {
      markCloudHealthy();
      return response;
    }

    markCloudUnavailable();
    return fetchLegacy(path, requestInit);
  } catch (error) {
    if (requestInit.signal?.aborted) throw error;
    markCloudUnavailable();

    // Reads are safe to replay. A failed write is deliberately not replayed
    // after an ambiguous network error; the next user retry uses Vercel.
    if (isReadOnlyMethod(method)) return fetchLegacy(path, requestInit);
    throw error;
  }
}

/**
 * Accepts both the legacy `{ error: string, code }` payload and the shared
 * backend v1 `{ error: { code, message } }` envelope during the migration.
 */
export function parseApiError(
  payload: unknown,
  fallback: string,
): { code?: string; message: string } {
  if (!payload || typeof payload !== "object") return { message: fallback };

  const record = payload as Record<string, unknown>;
  const nestedError =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;
  const codeCandidate = nestedError?.code ?? record.code;
  const messageCandidate =
    nestedError?.message ??
    (typeof record.error === "string" ? record.error : record.message);

  const result: { code?: string; message: string } = {
    message:
      typeof messageCandidate === "string" && messageCandidate.trim()
        ? messageCandidate
        : fallback,
  };
  if (typeof codeCandidate === "string" && codeCandidate.trim()) {
    result.code = codeCandidate;
  }
  return result;
}
