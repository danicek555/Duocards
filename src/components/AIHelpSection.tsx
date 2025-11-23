"use client";

interface AIHelpSectionProps {
  aiHelpEnabled: boolean;
  onToggleAIHelp: () => void;
  autoTranslateEnabled: boolean;
  onToggleAutoTranslate: () => void;
  translateToOneWord: boolean;
  onToggleTranslateToOneWord: () => void;
  translateToPhrase: boolean;
  onToggleTranslateToPhrase: () => void;
  onTranslateAll: () => void;
  translatingIndex: number | null;
}

export default function AIHelpSection({
  aiHelpEnabled,
  onToggleAIHelp,
  autoTranslateEnabled,
  onToggleAutoTranslate,
  translateToOneWord,
  onToggleTranslateToOneWord,
  translateToPhrase,
  onToggleTranslateToPhrase,
  onTranslateAll,
  translatingIndex,
}: AIHelpSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
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
          <span className="text-xs text-gray-600 dark:text-gray-400">
            AI Help
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleAIHelp}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            aiHelpEnabled
              ? "bg-blue-600 dark:bg-blue-500"
              : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              aiHelpEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {/* AI Action Buttons */}
      {aiHelpEnabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
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
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Auto Translate
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleAutoTranslate}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                autoTranslateEnabled
                  ? "bg-green-600 dark:bg-green-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoTranslateEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Translate to one word
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleTranslateToOneWord}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                translateToOneWord
                  ? "bg-green-600 dark:bg-green-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  translateToOneWord ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Translate to whole phrase
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleTranslateToPhrase}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                translateToPhrase
                  ? "bg-green-600 dark:bg-green-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  translateToPhrase ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <button
            type="button"
            onClick={onTranslateAll}
            disabled={translatingIndex !== null}
            className="w-full px-2 py-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-purple-200 dark:border-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Instantly translate all empty translations"
          >
            <svg
              className="w-3.5 h-3.5"
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
            <span>Translate All</span>
          </button>
        </div>
      )}
    </div>
  );
}

