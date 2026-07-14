"use client";

import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/types";
import { useI18n } from "@/i18n/I18nProvider";

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export default function LanguageSwitcher({
  compact = false,
  className = "",
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!compact && (
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t("common.language")}
        </span>
      )}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white/70 p-0.5 dark:border-gray-600 dark:bg-gray-800/70">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              locale === code
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
            aria-pressed={locale === code}
          >
            {compact ? code.toUpperCase() : LOCALE_LABELS[code]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LanguageSelect({
  value,
  onChange,
  className = "",
}: {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("auth.selectAppLanguage")}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Locale)}
        className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t("auth.selectAppLanguageHint")}
      </p>
    </div>
  );
}
