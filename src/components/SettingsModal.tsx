"use client";

import { useEffect, useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getApiBackendSource,
  isVercelBackendForced,
  subscribeApiBackendSource,
  type ApiBackendSource,
} from "@/lib/apiUrl";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCoinGuide: () => void;
  onOpenLiveGameHistory: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onOpenCoinGuide,
  onOpenLiveGameHistory,
}: SettingsModalProps) {
  const { t } = useI18n();
  const [backendSource, setBackendSource] = useState<ApiBackendSource>(
    getApiBackendSource,
  );
  const vercelForced = isVercelBackendForced();

  useEffect(() => subscribeApiBackendSource(setBackendSource), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-5 dark:border-gray-700 dark:from-blue-900/20 dark:to-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.983 5.02a1.5 1.5 0 012.91 0 1.5 1.5 0 002.24.93 1.5 1.5 0 012.058 2.058 1.5 1.5 0 00.93 2.24 1.5 1.5 0 010 2.91 1.5 1.5 0 00-.93 2.24 1.5 1.5 0 01-2.058 2.058 1.5 1.5 0 00-2.24.93 1.5 1.5 0 01-2.91 0 1.5 1.5 0 00-2.24-.93 1.5 1.5 0 01-2.058-2.058 1.5 1.5 0 00-.93-2.24 1.5 1.5 0 010-2.91 1.5 1.5 0 00.93-2.24A1.5 1.5 0 019.743 5.95a1.5 1.5 0 002.24-.93z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11.703a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 id="settings-title" className="text-xl font-bold text-gray-900 dark:text-white">
                {t("settings.title")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-white/70 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] space-y-4 overflow-y-auto p-6">
          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">{t("settings.appLanguage")}</h3>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t("settings.appLanguageHint")}</p>
            <LanguageSwitcher compact />
          </section>

          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16M6 5v4m0 2v4m0 2v2" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {t("settings.apiBackendTitle")}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      backendSource === "cloud-run"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : backendSource === "vercel"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {backendSource === "cloud-run"
                      ? t("settings.apiBackendCloudRun")
                      : backendSource === "vercel"
                        ? t("settings.apiBackendVercel")
                        : t("settings.apiBackendUnknown")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("settings.apiBackendHint")}
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t(
                    vercelForced
                      ? "settings.apiBackendForcedHint"
                      : "settings.apiBackendAutoHint",
                  )}
                </p>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={onOpenCoinGuide}
            className="group flex w-full items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:hover:border-purple-700 dark:hover:bg-purple-900/20"
          >
            <div className="rounded-xl bg-purple-100 p-2.5 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1m9-5a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t("settings.aiCoinsTitle")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.aiCoinsHint")}</p>
            </div>
            <span className="text-xl text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-purple-500 dark:text-gray-600">→</span>
          </button>

          <button
            type="button"
            onClick={onOpenLiveGameHistory}
            className="group flex w-full items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
          >
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t("settings.liveGameHistoryTitle")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.liveGameHistoryHint")}</p>
            </div>
            <span className="text-xl text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500 dark:text-gray-600">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
