"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { useConsent } from "./ConsentProvider";

/**
 * Bottom cookie banner shown until the user makes an analytics choice. It only
 * appears after the stored choice has been read (avoids a hydration flash) and
 * disappears once consent is granted or denied.
 */
export default function CookieConsentBanner() {
  const { consent, hydrated, grant, deny } = useConsent();
  const { t } = useI18n();

  if (!hydrated || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("cookieConsent.title")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4"
    >
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("cookieConsent.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {t("cookieConsent.message")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={deny}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t("cookieConsent.decline")}
            </button>
            <button
              type="button"
              onClick={grant}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {t("cookieConsent.accept")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
