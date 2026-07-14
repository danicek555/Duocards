"use client";

import AuthBackground from "@/components/AuthBackground";
import { useI18n } from "@/i18n/I18nProvider";

export default function AuthLoadingFallback() {
  const { t } = useI18n();

  return (
    <AuthBackground>
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("common.loading")}
        </p>
      </div>
    </AuthBackground>
  );
}
