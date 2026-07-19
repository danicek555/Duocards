"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/I18nProvider";

export default function MobileNotSupportedOverlay() {
  const { t } = useI18n();
  const configuredAppStoreUrl =
    process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim();
  const appStoreUrl =
    configuredAppStoreUrl?.startsWith("https://apps.apple.com/") ||
    configuredAppStoreUrl?.startsWith("https://testflight.apple.com/")
      ? configuredAppStoreUrl
      : null;

  return (
    <div
      className="fixed inset-0 z-200 flex overflow-y-auto bg-gray-950/95 px-4 py-[max(1rem,env(safe-area-inset-top))] text-center backdrop-blur-xl lg:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mobile-not-supported-title"
      aria-describedby="mobile-not-supported-desc"
    >
      <div className="relative m-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/15 bg-gray-900/95 px-5 pb-6 pt-5 shadow-2xl shadow-black/50">
        <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-60 w-60 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-left">
              <Image
                src="/duocards-app-icon-512.png"
                alt=""
                width={44}
                height={44}
                priority
                className="h-11 w-11 rounded-xl shadow-lg shadow-blue-950/40"
              />
              <div>
                <p className="font-bold leading-tight text-white">DuoCards</p>
                <p className="text-[11px] text-gray-400">
                  {t("mobile.mobileApp")}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-blue-400/25 bg-blue-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-200">
              iPhone
            </span>
          </div>

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white shadow-inner">
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <rect x="7" y="2" width="10" height="20" rx="2.5" strokeWidth="1.8" />
              <path d="M10.5 5h3M11 19h2" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
            {t("mobile.desktopOnly")}
          </p>
          <h1
            id="mobile-not-supported-title"
            className="text-balance text-2xl font-black tracking-tight text-white"
          >
            {t("mobile.title")}
          </h1>
          <p
            id="mobile-not-supported-desc"
            className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-300"
          >
            {t("mobile.body")}
          </p>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          {appStoreUrl ? (
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-left text-gray-950 shadow-xl transition active:scale-[0.98]"
              aria-label={t("mobile.downloadAppStore")}
            >
              <AppleLogo />
              <span>
                <span className="block text-[10px] font-semibold uppercase leading-none tracking-wide text-gray-500">
                  {t("mobile.downloadOn")}
                </span>
                <span className="mt-1 block text-lg font-bold leading-none">
                  App Store
                </span>
              </span>
            </a>
          ) : (
            <div
              className="mx-auto flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-5 py-3.5 text-left text-white"
              aria-label={t("mobile.comingSoonAppStore")}
            >
              <AppleLogo />
              <span>
                <span className="block text-[10px] font-semibold uppercase leading-none tracking-wide text-gray-400">
                  {t("mobile.comingSoon")}
                </span>
                <span className="mt-1 block text-lg font-bold leading-none">
                  App Store
                </span>
              </span>
            </div>
          )}

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/8 bg-black/20 px-3.5 py-3 text-left">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="13" rx="2" strokeWidth="1.8" />
              <path d="M8 21h8M12 17v4" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p className="text-xs leading-relaxed text-gray-400">
              {t("mobile.computerHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppleLogo() {
  return (
    <svg
      className="h-8 w-8 shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.7 12.8c0-2.5 2.1-3.7 2.2-3.8a4.7 4.7 0 0 0-3.7-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-1-3.3-1-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.4-.8 1.6 0 2.1.8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-3.9ZM14.2 5.3A4.2 4.2 0 0 0 15.2 2a4.6 4.6 0 0 0-3 1.6 4 4 0 0 0-1.1 3.1c1.1.1 2.3-.5 3.1-1.4Z" />
    </svg>
  );
}
