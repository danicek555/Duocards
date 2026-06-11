export const CONTENT_VIOLATION_DEFAULT_RETRY_SEC = 5 * 60;

export function isContentViolationError(message: string): boolean {
  return (
    message.includes("paused for a few minutes") ||
    message.includes("community guidelines")
  );
}

export function getContentViolationRetrySeconds(
  response?: Response | null
): number {
  const header = response?.headers.get("Retry-After");
  if (header) {
    const sec = Number.parseInt(header, 10);
    if (Number.isFinite(sec) && sec > 0) return sec;
  }
  return CONTENT_VIOLATION_DEFAULT_RETRY_SEC;
}
