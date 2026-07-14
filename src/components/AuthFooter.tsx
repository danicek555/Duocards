"use client";

import { useI18n } from "@/i18n/I18nProvider";

export default function AuthFooter() {
  const { t } = useI18n();

  return (
    <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-500">
      {t("common.freeNoCard")}{" "}
      <a
        href="https://www.duocards.xyz/"
        className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        duocards.xyz
      </a>
    </p>
  );
}
