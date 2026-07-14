export type Locale = "cs" | "en";

export const LOCALES: Locale[] = ["cs", "en"];

export const DEFAULT_LOCALE: Locale = "cs";

export const LOCALE_LABELS: Record<Locale, string> = {
  cs: "Čeština",
  en: "English",
};

export const LOCALE_COOKIE = "locale";
export const LOCALE_STORAGE_KEY = "locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "cs" || value === "en";
}

export function normalizeLocale(value: string | null | undefined): Locale {
  if (value === "en") return "en";
  if (value === "cs") return "cs";
  if (value?.toLowerCase().startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}
