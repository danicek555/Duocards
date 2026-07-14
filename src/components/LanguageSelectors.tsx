"use client";

import { getLanguageLabel, LANGUAGES } from "@/lib/languages";
import { useI18n } from "@/i18n/I18nProvider";

interface LanguageSelectorsProps {
  fromLanguage: string;
  toLanguage: string;
  onFromLanguageChange: (language: string) => void;
  onToLanguageChange: (language: string) => void;
}

export default function LanguageSelectors({
  fromLanguage,
  toLanguage,
  onFromLanguageChange,
  onToLanguageChange,
}: LanguageSelectorsProps) {
  const { t, locale } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {t("createSet.fromLanguage")}
        </label>
        <select
          value={fromLanguage}
          onChange={(e) => onFromLanguageChange(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {getLanguageLabel(lang.value, locale)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {t("createSet.toLanguage")}
        </label>
        <select
          value={toLanguage}
          onChange={(e) => onToLanguageChange(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {getLanguageLabel(lang.value, locale)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
