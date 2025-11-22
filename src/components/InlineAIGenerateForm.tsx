"use client";

import { useMemo, useState } from "react";
import { COIN_COSTS } from "@/lib/coin-costs";
import { LANGUAGES } from "@/lib/languages";

interface InlineAIGenerateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const LEVELS = [
  { value: "A1", label: "A1 (Beginner)" },
  { value: "A2", label: "A2 (Elementary)" },
  { value: "B1", label: "B1 (Intermediate)" },
  { value: "B2", label: "B2 (Upper Intermediate)" },
  { value: "C1", label: "C1 (Advanced)" },
  { value: "C2", label: "C2 (Proficiency)" },
];

export default function InlineAIGenerateForm({
  onSuccess,
  onCancel,
}: InlineAIGenerateFormProps) {
  const [level, setLevel] = useState("A1");
  const [topic, setTopic] = useState("");
  const [fromLanguage, setFromLanguage] = useState("English");
  const [toLanguage, setToLanguage] = useState("Spanish");
  const [wordCount, setWordCount] = useState(5);
  const [setName, setSetName] = useState("");
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

    if (includePronunciation) {
      cost += wordCount * COIN_COSTS.PRONUNCIATION_GENERATION; // 1 coin per pronunciation
    }

    return cost;
  }, [wordCount, includeImage, includeVoice, includePronunciation]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!topic.trim()) {
      setError("Please enter a topic");
      return;
    }

    if (!setName.trim()) {
      setError("Please enter a flashcard set name");
      return;
    }

    if (fromLanguage === toLanguage) {
      setError("From and To languages must be different");
      return;
    }

    if (wordCount < 1 || wordCount > 10) {
      setError("Word count must be between 1 and 10");
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
          fromLanguage,
          toLanguage,
          wordCount,
          setName: setName.trim(),
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
      // Reset form
      setTopic("");
      setSetName("");
      setWordCount(5);
      setLevel("A1");
      setFromLanguage("English");
      setToLanguage("Spanish");
      setIncludeImage(false);
      setIncludeVoice(false);
      setIncludePronunciation(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate flashcards"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-purple-500 dark:border-purple-400 p-4">
      <div className="mb-3 flex items-center gap-2">
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
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          AI Generate Flashcards
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Set Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Flashcard Set Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="e.g., Food & Cooking A1"
            maxLength={20}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
            required
          />
        </div>

        {/* Topic */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Topic <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Food & Cooking, Travel"
            maxLength={20}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
            required
          />
        </div>

        {/* Level */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            CEFR Level <span className="text-red-500">*</span>
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
            required
          >
            {LEVELS.map((lvl) => (
              <option key={lvl.value} value={lvl.value}>
                {lvl.label}
              </option>
            ))}
          </select>
        </div>

        {/* From and To Languages */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              From Language <span className="text-red-500">*</span>
            </label>
            <select
              value={fromLanguage}
              onChange={(e) => setFromLanguage(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
              required
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              To Language <span className="text-red-500">*</span>
            </label>
            <select
              value={toLanguage}
              onChange={(e) => setToLanguage(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
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
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Number of Flashcards <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWordCount(Math.max(1, wordCount - 1))}
              disabled={wordCount <= 1}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-base shadow-sm cursor-pointer active:scale-95 disabled:active:scale-100"
            >
              −
            </button>
            <div className="flex-1 px-3 py-1.5 text-center border-2 border-purple-300 dark:border-purple-600 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {wordCount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setWordCount(Math.min(10, wordCount + 1))}
              disabled={wordCount >= 10}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-base shadow-sm cursor-pointer active:scale-95 disabled:active:scale-100"
            >
              +
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            Choose between 1 and 10 flashcards
          </p>
        </div>

        {/* Additional Features */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Features
          </label>
          <div className="flex flex-wrap gap-2">
            {/* Image Toggle */}
            <button
              type="button"
              onClick={() => setIncludeImage(!includeImage)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                includeImage
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-400 dark:border-purple-500"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600"
              } cursor-pointer active:scale-95`}
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Image
            </button>

            {/* Voice Toggle */}
            <button
              type="button"
              onClick={() => setIncludeVoice(!includeVoice)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                includeVoice
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-400 dark:border-purple-500"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600"
              } cursor-pointer active:scale-95`}
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
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Voice
            </button>

            {/* Pronunciation Toggle */}
            <button
              type="button"
              onClick={() => setIncludePronunciation(!includePronunciation)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                includePronunciation
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-400 dark:border-purple-500"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600"
              } cursor-pointer active:scale-95`}
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
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              Pronunciation
            </button>
          </div>
        </div>
        {/* Cost Calculation */}
        <div className="p-4 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/30 border-2 border-purple-400 dark:border-purple-600 rounded-lg mt-3 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
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
              <span className="text-base font-bold text-purple-800 dark:text-purple-200">
                Total Cost
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-300">
                {totalCost} coin{totalCost !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300 bg-white/80 dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-purple-300 dark:border-purple-700">
            <div className="font-semibold mb-1.5 text-purple-800 dark:text-purple-200">
              Cost Breakdown:
            </div>
            <div className="space-y-1">
              <div className="font-medium">
                {wordCount} word{wordCount !== 1 ? "s" : ""} × 1 coin ={" "}
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  {wordCount * COIN_COSTS.WORD_TRANSLATION} coin
                  {wordCount * COIN_COSTS.WORD_TRANSLATION !== 1 ? "s" : ""}
                </span>
              </div>
              {includeImage && (
                <div className="font-medium">
                  + {wordCount} image{wordCount !== 1 ? "s" : ""} ×{" "}
                  {COIN_COSTS.IMAGE_GENERATION} coins ={" "}
                  <span className="text-purple-600 dark:text-purple-400 font-bold">
                    {wordCount * COIN_COSTS.IMAGE_GENERATION} coins
                  </span>
                </div>
              )}
              {includePronunciation && (
                <div className="font-medium">
                  + {wordCount} pronunciation{wordCount !== 1 ? "s" : ""} ×{" "}
                  {COIN_COSTS.PRONUNCIATION_GENERATION} coin
                  {COIN_COSTS.PRONUNCIATION_GENERATION !== 1 ? "s" : ""} ={" "}
                  <span className="text-purple-600 dark:text-purple-400 font-bold">
                    {wordCount * COIN_COSTS.PRONUNCIATION_GENERATION} coin
                    {wordCount * COIN_COSTS.PRONUNCIATION_GENERATION !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>
              )}
              {includeVoice && (
                <div className="font-medium">
                  + {wordCount} audio{wordCount !== 1 ? "s" : ""} ×{" "}
                  {COIN_COSTS.AUDIO_GENERATION} coins ={" "}
                  <span className="text-purple-600 dark:text-purple-400 font-bold">
                    {wordCount * COIN_COSTS.AUDIO_GENERATION} coins
                  </span>
                </div>
              )}
              {!includeImage && !includeVoice && !includePronunciation && (
                <div className="text-purple-600 dark:text-purple-400 italic text-xs">
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

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs cursor-pointer active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer active:scale-[0.98] disabled:active:scale-100"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5"
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
                  className="w-3.5 h-3.5"
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
  );
}
