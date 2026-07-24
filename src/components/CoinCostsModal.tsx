"use client";

import { useEffect } from "react";
import { COIN_COSTS } from "@/lib/coin-costs";
import { useI18n } from "@/i18n/I18nProvider";

interface CoinCostsModalProps {
  isOpen: boolean;
  // Dismiss to the dashboard (the "X" and backdrop).
  onClose: () => void;
  // Go back to where the guide was opened from — the settings modal. Falls
  // back to onClose when not provided.
  onBack?: () => void;
}

export default function CoinCostsModal({
  isOpen,
  onClose,
  onBack,
}: CoinCostsModalProps) {
  const { t } = useI18n();
  const goBack = onBack ?? onClose;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        goBack();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scrolling when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      // Restore body scrolling when modal closes
      document.body.style.overflow = "unset";
    };
  }, [isOpen, goBack]);

  if (!isOpen) return null;

  // AI Generation Costs
  const aiGenerationCosts = [
    {
      name: t("coins.flashcardGen"),
      description: t("coins.flashcardGenDesc"),
      cost: 1,
      costPerItem: true,
      itemName: "word",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
    {
      name: t("coins.pronunciation"),
      description: t("coins.pronunciationDesc"),
      cost: COIN_COSTS.PRONUNCIATION_GENERATION,
      costPerItem: true,
      itemName: "word",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      ),
    },
    {
      name: t("coins.phrase"),
      description: t("coins.phraseDesc"),
      cost: COIN_COSTS.PHRASE_GENERATION,
      costPerItem: true,
      itemName: "word",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h6m-6 8 3-4h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12l4 2z"
          />
        </svg>
      ),
    },
    {
      name: t("coins.translation"),
      description: t("coins.translationDesc"),
      cost: COIN_COSTS.WORD_TRANSLATION,
      costPerItem: true,
      itemName: "word",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
          />
        </svg>
      ),
    },
    {
      name: t("coins.audioGen"),
      description: t("coins.audioGenDesc"),
      cost: COIN_COSTS.AUDIO_GENERATION,
      costPerItem: true,
      itemName: "audio",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      ),
    },
    {
      name: t("coins.ocr"),
      description: t("coins.ocrDesc"),
      cost: COIN_COSTS.OCR_EXTRACTION,
      costPerItem: true,
      itemName: "image",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: t("coins.imageGen"),
      description: t("coins.imageGenDesc"),
      cost: COIN_COSTS.IMAGE_GENERATION,
      costPerItem: true,
      itemName: "image",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop - very subtle dark overlay */}
      <div
        className="fixed inset-0 transition-opacity bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4 overflow-y-auto">
        <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border-2 border-purple-200 dark:border-purple-800">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900 mr-3">
                  <svg
                    className="w-6 h-6 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t("coins.title")}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
            {/* Section 1: AI Generation Cost */}
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
              <div className="flex items-center mb-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 mr-3">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("coins.generationCost")}
                </h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t("coins.generationCostHint")}
              </p>
              <div className="space-y-3">
                {aiGenerationCosts.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start p-4 rounded-lg border-2 transition-colors bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700"
                  >
                    <div className="p-2 rounded-lg mr-4 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-semibold text-gray-900 dark:text-white">
                          {item.name}
                        </h5>
                        <div className="flex items-center">
                          <span className="text-2xl font-bold text-red-600 dark:text-red-400 mr-1">
                            {item.cost}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {item.cost === 1 ? t("coins.coin") : t("coins.coins")}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Completion Reward */}
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center mb-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 mr-3">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("coins.completionReward")}
                </h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t("coins.completionRewardHint")}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                  <span className="text-gray-700 dark:text-gray-300">
                    {t("coins.lessThanFive")}
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    1 {t("coins.coin")}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                  <span className="text-gray-700 dark:text-gray-300">
                    {t("coins.fiveToNine")}
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    5 {t("coins.coins")}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                  <span className="text-gray-700 dark:text-gray-300">
                    {t("coins.tenToTwentyFour")}
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    10 {t("coins.coins")}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                  <span className="text-gray-700 dark:text-gray-300">
                    {t("coins.twentyFiveOrMore")}
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    25 {t("coins.coins")}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {t("coins.completionTip")}
              </p>
            </div>

            {/* Section 3: AI Helper */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center mb-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mr-3">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("coins.aiHelper")}
                </h4>
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {t("coins.aiChatAssistant")}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t("coins.aiChatAssistantHint")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {COIN_COSTS.AI_CHAT}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 block">
                    {t("coins.coinsPerMessage")}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 4: Examples of Generation Cost */}
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 mr-3">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("coins.examples")}
                </h4>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700">
                    <p>
                      <span className="font-semibold">{t("coins.exampleFive")}</span> ={" "}
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        5 {t("coins.coins")}
                      </span>{" "}
                      (5 × 1 {t("coins.coin")})
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700">
                    <p>
                      <span className="font-semibold">{t("coins.exampleTen")}</span> ={" "}
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        10 {t("coins.coins")}
                      </span>{" "}
                      (10 × 1 {t("coins.coin")})
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700">
                    <p>
                      <span className="font-semibold">
                        {t("coins.exampleFiveImages")}
                      </span>{" "}
                      ={" "}
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        405 {t("coins.coins")}
                      </span>{" "}
                      (5 × 1 + 5 × 80)
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700">
                    <p>
                      <span className="font-semibold">
                        {t("coins.exampleTenImages")}
                      </span>{" "}
                      ={" "}
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        810 {t("coins.coins")}
                      </span>{" "}
                      (10 × 1 + 10 × 80)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={goBack}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
            >
              {t("coins.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
