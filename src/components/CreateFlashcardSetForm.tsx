"use client";

import { useState, useEffect, useRef } from "react";
import { LANGUAGES } from "@/lib/languages";

interface WordPair {
  word: string;
  translation: string;
  pronunciation?: string;
  imageUrl?: string;
  audioUrl?: string;
}

interface CreateFlashcardSetFormProps {
  onClose: () => void;
  onSuccess: () => void;
  onCoinsUpdate?: () => void;
}

export default function CreateFlashcardSetForm({
  onClose,
  onSuccess,
  onCoinsUpdate,
}: CreateFlashcardSetFormProps) {
  const [setName, setSetName] = useState("");
  const [fromLanguage, setFromLanguage] = useState("English");
  const [toLanguage, setToLanguage] = useState("Spanish");
  const [addAmount, setAddAmount] = useState(5);
  const [wordPairs, setWordPairs] = useState<WordPair[]>(
    Array.from({ length: 5 }, () => ({ word: "", translation: "" }))
  );
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiHelpEnabled, setAiHelpEnabled] = useState(false);
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);
  const [generatingPronunciationIndex, setGeneratingPronunciationIndex] =
    useState<number | null>(null);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(
    new Set()
  );
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(true);
  const debounceTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const translatingRef = useRef<Set<number>>(new Set());

  const addWordPair = () => {
    const newPairs = [
      ...wordPairs,
      ...Array.from({ length: addAmount }, () => ({
        word: "",
        translation: "",
      })),
    ];
    setWordPairs(newPairs);
  };

  const handleImageUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setWordPairs((prev) => {
        const updated = [...prev];
        updated[index].imageUrl = dataUrl;
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setWordPairs((prev) => {
        const updated = [...prev];
        updated[index].audioUrl = dataUrl;
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const updatePronunciation = (index: number, value: string) => {
    setWordPairs((prev) => {
      const updated = [...prev];
      updated[index].pronunciation = value;
      return updated;
    });
  };

  const removeWordPair = (index: number) => {
    if (wordPairs.length > 1 && deletingIndex === null) {
      setDeletingIndex(index);
      // Wait for animation to complete before removing
      setTimeout(() => {
        const newPairs = wordPairs.filter((_, i) => i !== index);
        setWordPairs(newPairs);
        setDeletingIndex(null);
      }, 300); // Match animation duration
    }
  };

  const translateWord = async (
    word: string,
    index: number,
    overwrite: boolean = false
  ) => {
    if (!word.trim() || !aiHelpEnabled) return;

    // Prevent duplicate calls - if already translating this index, skip
    if (translatingRef.current.has(index)) return;

    translatingRef.current.add(index);
    setTranslatingIndex(index);

    try {
      const response = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.trim(),
          fromLanguage,
          toLanguage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translation) {
          setWordPairs((prev) => {
            const updated = [...prev];
            // If overwrite is true (manual regenerate), always update
            // Otherwise, only update if translation field is empty
            if (overwrite || !updated[index].translation.trim()) {
              updated[index].translation = data.translation;
            }
            return updated;
          });
          // Refresh coins after successful translation
          if (onCoinsUpdate) {
            onCoinsUpdate();
          }
        }
      }
    } catch (err) {
      // Silently fail - don't show error for auto-translation
      console.error("Translation error:", err);
    } finally {
      translatingRef.current.delete(index);
      setTranslatingIndex(null);
    }
  };

  const handleRegenerateTranslation = async (index: number) => {
    const word = wordPairs[index].word;
    if (word.trim()) {
      await translateWord(word, index, true);
    }
  };

  const generatePronunciation = async (index: number) => {
    const translation = wordPairs[index].translation;
    if (!translation.trim() || !aiHelpEnabled) return;

    setGeneratingPronunciationIndex(index);

    try {
      const response = await fetch("/api/generate-pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: translation.trim(),
          language: toLanguage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.pronunciation) {
          setWordPairs((prev) => {
            const updated = [...prev];
            updated[index].pronunciation = data.pronunciation;
            return updated;
          });
          // Refresh coins after successful pronunciation generation
          if (onCoinsUpdate) {
            onCoinsUpdate();
          }
        }
      }
    } catch (err) {
      // Silently fail - don't show error for auto-generation
      console.error("Pronunciation generation error:", err);
    } finally {
      setGeneratingPronunciationIndex(null);
    }
  };

  const updateWordPair = (
    index: number,
    field: "word" | "translation",
    value: string
  ) => {
    const updated = [...wordPairs];
    updated[index][field] = value;
    setWordPairs(updated);

    // If updating word field and AI Help is enabled, debounce translation
    if (
      field === "word" &&
      aiHelpEnabled &&
      autoTranslateEnabled &&
      value.trim()
    ) {
      // Don't translate if translation field already has content
      if (updated[index].translation.trim()) {
        // Clear existing timer if translation already exists
        const existingTimer = debounceTimers.current.get(index);
        if (existingTimer) {
          clearTimeout(existingTimer);
          debounceTimers.current.delete(index);
        }
        return;
      }

      // Clear existing timer for this index
      const existingTimer = debounceTimers.current.get(index);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(() => {
        // Check again before translating (user might have typed translation)
        setWordPairs((prev) => {
          // Only translate if translation is still empty and not already translating
          if (
            !prev[index].translation.trim() &&
            !translatingRef.current.has(index)
          ) {
            translateWord(prev[index].word, index, false);
          }
          return prev;
        });
        debounceTimers.current.delete(index);
      }, 500); // Wait 0.5 seconds after user stops typing

      debounceTimers.current.set(index, timer);
    } else if (field === "word" && !autoTranslateEnabled) {
      // Cancel any pending translation for this word if auto-translate is disabled
      const existingTimer = debounceTimers.current.get(index);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimers.current.delete(index);
      }
    }
  };

  // Toggle auto-translate and cancel all pending translations when disabling
  const toggleAutoTranslate = () => {
    const newState = !autoTranslateEnabled;
    setAutoTranslateEnabled(newState);

    // If disabling, cancel all pending translations
    if (!newState) {
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
      debounceTimers.current.clear();
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!setName.trim()) {
      setError("Please enter a name for the flashcard set");
      return;
    }

    const validPairs = wordPairs.filter(
      (pair) => pair.word.trim() && pair.translation.trim()
    );

    if (validPairs.length === 0) {
      setError("Please add at least one word pair");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/flashcard-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: setName.trim(),
          words: validPairs,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create flashcard set");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create flashcard set"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Flashcard Set
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Set Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Flashcard Set Name
            </label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g., Spanish Basics"
              maxLength={20}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* From and To Languages */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Language
              </label>
              <select
                value={fromLanguage}
                onChange={(e) => setFromLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
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
                To Language
              </label>
              <select
                value={toLanguage}
                onChange={(e) => setToLanguage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Help Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-500 dark:text-gray-400"
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
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  AI Help
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAiHelpEnabled(!aiHelpEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  aiHelpEnabled
                    ? "bg-blue-600 dark:bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    aiHelpEnabled ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            {/* AI Action Buttons */}
            {aiHelpEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-gray-500 dark:text-gray-400"
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Auto Translate
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAutoTranslate}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      autoTranslateEnabled
                        ? "bg-green-600 dark:bg-green-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        autoTranslateEnabled
                          ? "translate-x-6"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Translate all empty translations instantly
                    wordPairs.forEach((pair, idx) => {
                      // Only translate if word exists, translation is empty, and not already translating
                      if (
                        pair.word.trim() &&
                        !pair.translation.trim() &&
                        !translatingRef.current.has(idx)
                      ) {
                        translateWord(pair.word, idx, false);
                      }
                    });
                  }}
                  disabled={translatingIndex !== null}
                  className="w-full px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors flex items-center justify-center gap-2 border border-purple-200 dark:border-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Instantly translate all empty translations"
                >
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
                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    />
                  </svg>
                  <span>Translate All</span>
                </button>
              </div>
            )}
          </div>

          {/* Expand All Button */}
          <button
            type="button"
            onClick={() => {
              if (expandedIndices.size === wordPairs.length) {
                // Collapse all
                setExpandedIndices(new Set());
              } else {
                // Expand all
                setExpandedIndices(new Set(wordPairs.map((_, i) => i)));
              }
            }}
            className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className={`w-4 h-4 transition-transform ${
                expandedIndices.size === wordPairs.length ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <span>
              {expandedIndices.size === wordPairs.length
                ? "Collapse All"
                : "Expand All"}
            </span>
          </button>

          {/* Word Pairs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Words and Translations
            </label>
            <div className="space-y-4">
              {wordPairs.map((pair, index) => (
                <div
                  key={index}
                  className={`flex flex-col gap-3 items-start p-5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm transition-all duration-300 ${
                    deletingIndex === index
                      ? "opacity-0 scale-95 -translate-x-4 pointer-events-none"
                      : "opacity-100 scale-100 translate-x-0"
                  }`}
                >
                  <div className="flex gap-3 items-start w-full">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                          Word
                        </label>
                        <input
                          type="text"
                          value={pair.word}
                          onChange={(e) =>
                            updateWordPair(index, "word", e.target.value)
                          }
                          placeholder="Enter word"
                          maxLength={50}
                          className="px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full transition-colors"
                        />
                      </div>
                      <div className="relative">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                          Translation
                        </label>
                        <input
                          type="text"
                          value={pair.translation}
                          onChange={(e) =>
                            updateWordPair(index, "translation", e.target.value)
                          }
                          placeholder="Enter translation"
                          maxLength={50}
                          className="px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full transition-colors"
                        />
                        {translatingIndex === index && (
                          <div className="absolute right-3 top-[calc(50%+0.75rem)] -translate-y-1/2">
                            <svg
                              className="animate-spin h-4 w-4 text-blue-500"
                              xmlns="http://www.w3.org/2000/svg"
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
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {aiHelpEnabled && pair.word.trim() && (
                        <button
                          type="button"
                          onClick={() => handleRegenerateTranslation(index)}
                          disabled={translatingIndex === index}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Regenerate translation"
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
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedIndices((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(index)) {
                              newSet.delete(index);
                            } else {
                              newSet.add(index);
                            }
                            return newSet;
                          });
                        }}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="More options"
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${
                            expandedIndices.has(index) ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {wordPairs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWordPair(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedIndices.has(index) && (
                    <div className="w-full mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4 opacity-80">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                          Pronunciation
                        </label>
                        <div className="flex gap-2 items-center">
                          {aiHelpEnabled && pair.translation.trim() && (
                            <button
                              type="button"
                              onClick={() => generatePronunciation(index)}
                              disabled={generatingPronunciationIndex === index}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                              title="Generate pronunciation"
                            >
                              {generatingPronunciationIndex === index ? (
                                <svg
                                  className="animate-spin h-4 w-4"
                                  xmlns="http://www.w3.org/2000/svg"
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
                              ) : (
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
                              )}
                            </button>
                          )}
                          <input
                            type="text"
                            value={pair.pronunciation || ""}
                            onChange={(e) =>
                              updatePronunciation(index, e.target.value)
                            }
                            placeholder="e.g., /həˈloʊ/"
                            maxLength={50}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                            Image
                          </label>
                          <label className="flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors">
                            <svg
                              className="w-4 h-4 mr-2"
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
                            <span className="text-sm">
                              {pair.imageUrl ? "Change" : "Upload"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(index, file);
                              }}
                              className="hidden"
                            />
                          </label>
                          {pair.imageUrl && (
                            <div className="mt-2 relative">
                              <div className="w-full max-w-xl mx-auto">
                                <div className="relative w-full h-[380px] rounded-2xl overflow-hidden border-2 border-gray-300 dark:border-gray-600 shadow-lg">
                                  <img
                                    src={pair.imageUrl}
                                    alt="Word image preview"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 dark:bg-black/60"></div>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="text-white text-sm font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                                      Preview: This is how it will appear on
                                      flashcards
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWordPairs((prev) => {
                                        const updated = [...prev];
                                        updated[index].imageUrl = undefined;
                                        return updated;
                                      });
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg z-10"
                                  >
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
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                            Voice
                          </label>
                          <label className="flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors">
                            <svg
                              className="w-4 h-4 mr-2"
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
                            <span className="text-sm">
                              {pair.audioUrl ? "Change" : "Upload"}
                            </span>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAudioUpload(index, file);
                              }}
                              className="hidden"
                            />
                          </label>
                          {pair.audioUrl && (
                            <div className="mt-2">
                              <audio controls className="w-full h-8">
                                <source src={pair.audioUrl} />
                              </audio>
                              <button
                                type="button"
                                onClick={() => {
                                  setWordPairs((prev) => {
                                    const updated = [...prev];
                                    updated[index].audioUrl = undefined;
                                    return updated;
                                  });
                                }}
                                className="mt-1 text-xs text-red-600 hover:text-red-700"
                              >
                                Remove audio
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Preset Add Amount Buttons */}
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add amount:
              </label>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setAddAmount(amount)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      addAmount === amount
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Word Pair Button */}
            <button
              type="button"
              onClick={addWordPair}
              className="mt-3 w-full px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add {addAmount} More Words
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating..." : "Create Set"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
