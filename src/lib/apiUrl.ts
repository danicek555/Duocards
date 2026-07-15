const legacyApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api";

const sharedApiBaseUrl =
  process.env.NEXT_PUBLIC_SHARED_API_BASE_URL?.trim() || legacyApiBaseUrl;

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Builds a URL for endpoints already available on the shared backend.
 *
 * Set NEXT_PUBLIC_SHARED_API_BASE_URL=/shared-api to opt in. When it is not
 * configured, callers continue to use the existing API base (or /api).
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimTrailingSlashes(sharedApiBaseUrl)}${normalizedPath}`;
}

/**
 * Fetches a migrated API endpoint and includes cookies across origins by
 * default. Callers can still override the credentials mode explicitly.
 */
export function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    credentials: init.credentials ?? "include",
  });
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
