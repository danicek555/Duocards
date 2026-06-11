/** Calendar-day daily reward helpers (user's local timezone via getTimezoneOffset()). */

export function getLocalDateParts(
  date: Date,
  timezoneOffsetMinutes: number
): { year: number; month: number; day: number } {
  const localMs = date.getTime() - timezoneOffsetMinutes * 60 * 1000;
  const d = new Date(localMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}

/** True if `now` is on a later local calendar day than `lastClaim`. */
export function isNewLocalDay(
  lastClaim: Date,
  now: Date,
  timezoneOffsetMinutes: number
): boolean {
  const last = getLocalDateParts(lastClaim, timezoneOffsetMinutes);
  const current = getLocalDateParts(now, timezoneOffsetMinutes);

  if (current.year !== last.year) return current.year > last.year;
  if (current.month !== last.month) return current.month > last.month;
  return current.day > last.day;
}

/** Next local midnight after `now` (start of the next claim window). */
export function getNextLocalMidnight(
  now: Date,
  timezoneOffsetMinutes: number
): Date {
  const localMs = now.getTime() - timezoneOffsetMinutes * 60 * 1000;
  const d = new Date(localMs);
  const nextMidnightUtcMs = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1
  );
  return new Date(nextMidnightUtcMs + timezoneOffsetMinutes * 60 * 1000);
}

export function secondsUntilNextLocalMidnight(
  now: Date,
  timezoneOffsetMinutes: number
): number {
  const next = getNextLocalMidnight(now, timezoneOffsetMinutes);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}

export function parseTimezoneOffsetHeader(
  value: string | null,
  fallback = 0
): number {
  if (value === null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < -840 || n > 840) return fallback;
  return n;
}
