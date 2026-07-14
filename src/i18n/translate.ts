import { cs } from "./locales/cs";
import { en } from "./locales/en";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { additionalLocales } from "./locales/additional";
import type { Locale } from "./types";

const messages: Record<Locale, Record<string, unknown>> = {
  cs,
  en,
  de,
  es,
  fr,
  ...additionalLocales,
};

function getNestedValue(tree: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = tree;

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

export function createTranslator(locale: Locale) {
  const tree = messages[locale];

  return function t(
    key: string,
    params?: Record<string, string | number>,
  ): string {
    const value = getNestedValue(tree, key);
    if (!value) return key;
    return interpolate(value, params);
  };
}

export function translateApiError(
  locale: Locale,
  code: string | undefined,
  fallback?: string,
) {
  const t = createTranslator(locale);
  if (code) {
    const translated = t(`errors.${code}`);
    if (translated !== `errors.${code}`) return translated;
  }
  return fallback || t("errors.UNKNOWN_ERROR");
}
