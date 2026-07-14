"use client";

import { useI18n } from "@/i18n/I18nProvider";

export default function MobileNotSupportedOverlay() {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-200 flex lg:hidden flex-col items-center justify-center bg-slate-900/97 dark:bg-black/97 px-6 text-center backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mobile-not-supported-title"
      aria-describedby="mobile-not-supported-desc"
    >
      <div className="max-w-sm rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/20 text-3xl"
          aria-hidden
        >
          💻
        </div>
        <h1
          id="mobile-not-supported-title"
          className="text-xl font-semibold tracking-tight text-white"
        >
          {t("mobile.title")}
        </h1>
        <p
          id="mobile-not-supported-desc"
          className="mt-3 text-sm leading-relaxed text-slate-300"
        >
          {t("mobile.body")}
        </p>
      </div>
    </div>
  );
}
