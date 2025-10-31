"use client";

import { useState } from "react";

interface WordPair {
  word: string;
  translation: string;
}

interface CreateFlashcardSetFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateFlashcardSetForm({
  onClose,
  onSuccess,
}: CreateFlashcardSetFormProps) {
  const [setName, setSetName] = useState("");
  const [wordPairs, setWordPairs] = useState<WordPair[]>([
    { word: "", translation: "" },
    { word: "", translation: "" },
    { word: "", translation: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addWordPair = () => {
    setWordPairs([...wordPairs, { word: "", translation: "" }]);
  };

  const removeWordPair = (index: number) => {
    if (wordPairs.length > 1) {
      setWordPairs(wordPairs.filter((_, i) => i !== index));
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Word Pairs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Words and Translations
            </label>
            <div className="space-y-3">
              {wordPairs.map((pair, index) => (
                <div
                  key={index}
                  className="flex gap-3 items-start p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={pair.word}
                      onChange={(e) =>
                        updateWordPair(index, "word", e.target.value)
                      }
                      placeholder="Word"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={pair.translation}
                      onChange={(e) =>
                        updateWordPair(index, "translation", e.target.value)
                      }
                      placeholder="Translation"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
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
              ))}
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
              Add More Words
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
