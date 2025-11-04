"use client";

import { useState } from "react";

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

const LANGUAGES = [
  { value: "English", label: "English" },
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate flashcards"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-purple-500 dark:border-purple-400 p-6">
      <div className="mb-4 flex items-center gap-2">
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
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          AI Generate Flashcards
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Set Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Flashcard Set Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="e.g., Food & Cooking A1"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
            required
          />
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Topic <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Food & Cooking, Travel"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
            required
          />
        </div>

        {/* Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            CEFR Level <span className="text-red-500">*</span>
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From Language <span className="text-red-500">*</span>
            </label>
            <select
              value={fromLanguage}
              onChange={(e) => setFromLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To Language <span className="text-red-500">*</span>
            </label>
            <select
              value={toLanguage}
              onChange={(e) => setToLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Number of Flashcards <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWordCount(Math.max(1, wordCount - 1))}
              disabled={wordCount <= 1}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-sm cursor-pointer active:scale-95 disabled:active:scale-100"
            >
              −
            </button>
            <div className="flex-1 px-4 py-2 text-center border-2 border-purple-300 dark:border-purple-600 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              <span className="text-xl font-bold text-purple-700 dark:text-purple-300">
                {wordCount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setWordCount(Math.min(10, wordCount + 1))}
              disabled={wordCount >= 10}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-sm cursor-pointer active:scale-95 disabled:active:scale-100"
            >
              +
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 text-center">
            Choose between 1 and 10 flashcards
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm cursor-pointer active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98] disabled:active:scale-100"
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
  );
}
