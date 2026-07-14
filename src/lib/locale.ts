import { isLocale, normalizeLocale } from "@/i18n/types";

export function parseRequestLocale(value: string | null | undefined) {
  if (isLocale(value)) return value;
  return normalizeLocale(value);
}
