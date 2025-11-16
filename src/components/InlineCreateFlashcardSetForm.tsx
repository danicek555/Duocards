"use client";

import { useState } from "react";

interface WordPair {
  word: string;
  translation: string;
}

interface InlineCreateFlashcardSetFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

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

export default function InlineCreateFlashcardSetForm({
  onSuccess,
  onCancel,
}: InlineCreateFlashcardSetFormProps) {
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

  const updateWordPair = (
    index: number,
    field: "word" | "translation",
    value: string
  ) => {
    const updated = [...wordPairs];
    updated[index][field] = value;
    setWordPairs(updated);
  };

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
          fromLanguage,
          toLanguage,
          words: validPairs,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create flashcard set");
      }

      onSuccess();
      // Reset form
      setSetName("");
      setFromLanguage("English");
      setToLanguage("Spanish");
      setWordPairs(
        Array.from({ length: 5 }, () => ({ word: "", translation: "" }))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create flashcard set"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-blue-500 dark:border-blue-400 p-4">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          Create New Flashcard Set
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Set Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Flashcard Set Name
          </label>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="e.g., Spanish Basics"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* From and To Languages */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              From Language
            </label>
            <select
              value={fromLanguage}
              onChange={(e) => setFromLanguage(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
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
              To Language
            </label>
            <select
              value={toLanguage}
              onChange={(e) => setToLanguage(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Word Pairs */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Words and Translations
          </label>
          <div className="space-y-1.5">
            {wordPairs.map((pair, index) => (
              <div
                key={index}
                className={`flex gap-1.5 items-start p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-all duration-300 ${
                  deletingIndex === index
                    ? "opacity-0 scale-95 -translate-x-4 pointer-events-none"
                    : "opacity-100 scale-100 translate-x-0"
                }`}
              >
                <div className="flex-1 grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={pair.word}
                    onChange={(e) =>
                      updateWordPair(index, "word", e.target.value)
                    }
                    placeholder="Word"
                    className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={pair.translation}
                    onChange={(e) =>
                      updateWordPair(index, "translation", e.target.value)
                    }
                    placeholder="Translation"
                    className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {wordPairs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWordPair(index)}
                    className="px-1.5 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer active:scale-95"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Preset Add Amount Buttons */}
          <div className="mt-1.5">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Add amount:
            </label>
            <div className="flex gap-1.5">
              {[1, 5, 10, 15, 20].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setAddAmount(amount)}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer active:scale-95 ${
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
            className="mt-1.5 w-full px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer active:scale-[0.98]"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add {addAmount} More Words
          </button>
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
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs cursor-pointer active:scale-[0.98] disabled:active:scale-100"
          >
            {loading ? "Creating..." : "Create Set"}
          </button>
        </div>
      </form>
    </div>
  );
}
