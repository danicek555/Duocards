"use client";

import { useState, useMemo } from "react";
import { COIN_COSTS } from "@/lib/coins";

interface AIGenerateFlashcardFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const LANGUAGES = [
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Italian", label: "Italian" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Japanese", label: "Japanese" },
  { value: "Chinese", label: "Chinese (Mandarin)" },
  { value: "Korean", label: "Korean" },
  { value: "Russian", label: "Russian" },
  { value: "Arabic", label: "Arabic" },
  { value: "Dutch", label: "Dutch" },
  { value: "Swedish", label: "Swedish" },
  { value: "Norwegian", label: "Norwegian" },
  { value: "Polish", label: "Polish" },
  { value: "Turkish", label: "Turkish" },
];

export default function AIGenerateFlashcardForm({
  onClose,
  onSuccess,
}: AIGenerateFlashcardFormProps) {
  const [level, setLevel] = useState("beginner");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("Spanish");
  const [setName, setSetName] = useState("");
  const [wordCount, setWordCount] = useState(10);
  const [includeImage, setIncludeImage] = useState(false);
  const [includeVoice, setIncludeVoice] = useState(false);
  const [includePronunciation, setIncludePronunciation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Calculate total cost
  const totalCost = useMemo(() => {
    // 1 coin per word for flashcard generation
    let cost = wordCount * COIN_COSTS.WORD_TRANSLATION; // 1 coin per word

    if (includeImage) {
      cost += wordCount * COIN_COSTS.IMAGE_GENERATION; // 80 coins per image
    }

    if (includeVoice) {
      cost += wordCount * COIN_COSTS.AUDIO_GENERATION; // 5 coins per audio
    }

    // Pronunciation is included in text generation, no extra cost

    return cost;
  }, [wordCount, includeImage, includeVoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!topic.trim()) {
      setError("Please enter a topic");
      return;
    }

    if (wordCount < 5 || wordCount > 50) {
      setError("Word count must be between 5 and 50");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/flashcard-sets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          topic: topic.trim(),
          fromLanguage: "English",
          toLanguage: language,
          setName: setName.trim() || undefined,
          wordCount,
          includeImage,
          includeVoice,
          includePronunciation,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate flashcards");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate flashcards"
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate set name when topic, level, or language changes
  const updateSetName = () => {
    if (!setName) {
      const autoName = `${topic ? topic + " - " : ""}${level} (${language})`;
      setSetName(autoName.slice(0, 20));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
              AI Flashcard Generator
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="w-5 h-5"
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
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Let AI create flashcards based on your preferences
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-3 overflow-y-auto flex-1"
        >
          {/* Topic */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                updateSetName();
              }}
              placeholder="e.g., Food & Cooking, Travel"
              maxLength={20}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Level and Language - Side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Level <span className="text-red-500">*</span>
              </label>
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  updateSetName();
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Language <span className="text-red-500">*</span>
              </label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  updateSetName();
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Word Count */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Flashcards
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={wordCount}
              onChange={(e) => setWordCount(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              5-50 flashcards
            </p>
          </div>

          {/* Set Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Set Name (optional)
            </label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="Auto-generated if empty"
              maxLength={20}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Additional Features */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Features
            </label>

            {/* Include Images */}
            <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
              <input
                type="checkbox"
                checked={includeImage}
                onChange={(e) => setIncludeImage(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Include Images
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({COIN_COSTS.IMAGE_GENERATION} coins per image)
                </span>
              </div>
            </label>

            {/* Include Voice */}
            <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
              <input
                type="checkbox"
                checked={includeVoice}
                onChange={(e) => setIncludeVoice(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Include Voice/Audio
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({COIN_COSTS.AUDIO_GENERATION} coins per audio)
                </span>
              </div>
            </label>

            {/* Include Pronunciation */}
            <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
              <input
                type="checkbox"
                checked={includePronunciation}
                onChange={(e) => setIncludePronunciation(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Include Pronunciation
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  (included in base cost)
                </span>
              </div>
            </label>
          </div>

          {/* Cost Calculation */}
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-lg mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-600 dark:text-purple-400"
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
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                  Total Cost
                </span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {totalCost} coin{totalCost !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800/50 rounded px-2 py-1.5 border border-purple-200 dark:border-purple-700">
              <div className="font-medium mb-1">Breakdown:</div>
              <div className="space-y-0.5">
                <div>
                  {wordCount} word{wordCount !== 1 ? "s" : ""} × 1 coin ={" "}
                  {wordCount * COIN_COSTS.WORD_TRANSLATION} coin
                  {wordCount * COIN_COSTS.WORD_TRANSLATION !== 1 ? "s" : ""}
                </div>
                {includeImage && (
                  <div>
                    + {wordCount} image{wordCount !== 1 ? "s" : ""} ×{" "}
                    {COIN_COSTS.IMAGE_GENERATION} coins ={" "}
                    {wordCount * COIN_COSTS.IMAGE_GENERATION} coins
                  </div>
                )}
                {includeVoice && (
                  <div>
                    + {wordCount} audio{wordCount !== 1 ? "s" : ""} ×{" "}
                    {COIN_COSTS.AUDIO_GENERATION} coins ={" "}
                    {wordCount * COIN_COSTS.AUDIO_GENERATION} coins
                  </div>
                )}
                {!includeImage && !includeVoice && (
                  <div className="text-purple-500 dark:text-purple-500 italic">
                    No additional features selected
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Info Message */}
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400 text-xs">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-medium text-xs">AI-Powered Generation</p>
                <p className="text-xs mt-0.5">
                  Requires OPENAI_API_KEY in environment variables.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
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
                  Generate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
