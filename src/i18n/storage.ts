import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  PENDING_LANDING_LOCALE_COOKIE,
  SHARED_LOCALE_COOKIE,
  type Locale,
} from "./types";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string) {
  return document.cookie
    .split(";")
    .map((row) => row.trim())
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function cookieAttributes(maxAge: number) {
  const hostname = window.location.hostname.toLowerCase();
  const isDuocardsDomain =
    hostname === "duocards.xyz" || hostname.endsWith(".duocards.xyz");

  return [
    "path=/",
    `max-age=${maxAge}`,
    "samesite=lax",
    ...(isDuocardsDomain ? ["domain=.duocards.xyz", "secure"] : []),
  ].join(";");
}

function writeCookie(name: string, value: string, maxAge = LOCALE_COOKIE_MAX_AGE) {
  document.cookie = `${name}=${encodeURIComponent(value)};${cookieAttributes(maxAge)}`;
}

function readLocaleCookie(name: string): Locale | null {
  const rawValue = readCookie(name);
  if (!rawValue) return null;

  try {
    const value = decodeURIComponent(rawValue);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const pendingLandingLocale = getPendingLandingLocale();
  if (pendingLandingLocale) return pendingLandingLocale;

  const fromSharedCookie = readLocaleCookie(SHARED_LOCALE_COOKIE);
  if (fromSharedCookie) return fromSharedCookie;

  const fromStorage = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(fromStorage)) return fromStorage;

  const fromCookie = readLocaleCookie(LOCALE_COOKIE);
  if (isLocale(fromCookie)) return fromCookie;

  return normalizeLocale(navigator.language);
}

export function getPendingLandingLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  return readLocaleCookie(PENDING_LANDING_LOCALE_COOKIE);
}

export function clearPendingLandingLocale() {
  if (typeof window === "undefined") return;
  writeCookie(PENDING_LANDING_LOCALE_COOKIE, "", 0);
}

export function persistLocale(
  locale: Locale,
  options?: { clearPendingLandingLocale?: boolean },
) {
  if (typeof window === "undefined") return;

  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  writeCookie(LOCALE_COOKIE, locale);
  writeCookie(SHARED_LOCALE_COOKIE, locale);
  if (options?.clearPendingLandingLocale ?? true) {
    clearPendingLandingLocale();
  }
  document.documentElement.lang = locale;
}
