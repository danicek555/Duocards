export type Locale =
  | "cs" | "en" | "de" | "es" | "fr"
  | "ar" | "ca" | "zh" | "da" | "nl" | "fi" | "el" | "he"
  | "hi" | "hu" | "id" | "it" | "ja" | "ko" | "no" | "pl"
  | "pt" | "ro" | "ru" | "sv" | "th" | "tr" | "uk" | "vi";

export const LOCALES: Locale[] = [
  "ar", "ca", "zh", "cs", "da", "nl", "en", "fi", "fr", "de",
  "el", "he", "hi", "hu", "id", "it", "ja", "ko", "no", "pl",
  "pt", "ro", "ru", "es", "sv", "th", "tr", "uk", "vi",
];

export const DEFAULT_LOCALE: Locale = "cs";

export const LOCALE_LABELS: Record<Locale, string> = {
  cs: "Čeština",
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  ca: "Català",
  zh: "中文（普通话）",
  da: "Dansk",
  nl: "Nederlands",
  fi: "Suomi",
  el: "Ελληνικά",
  he: "עברית",
  hi: "हिन्दी",
  hu: "Magyar",
  id: "Bahasa Indonesia",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  no: "Norsk",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  ru: "Русский",
  sv: "Svenska",
  th: "ไทย",
  tr: "Türkçe",
  uk: "Українська",
  vi: "Tiếng Việt",
};

export const LOCALE_COOKIE = "locale";
export const LOCALE_STORAGE_KEY = "locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && (LOCALES as string[]).includes(value);
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === "ar" || locale === "he";
}

export function normalizeLocale(value: string | null | undefined): Locale {
  const language = value?.toLowerCase().split(/[-_]/)[0];
  if (isLocale(language)) return language;
  return DEFAULT_LOCALE;
}
