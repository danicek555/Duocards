"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import TagsInput from "./TagsInput";
import LanguageSelectors from "./LanguageSelectors";
import AIHelpSection from "./AIHelpSection";
import ImageUploadOCR from "./ImageUploadOCR";

interface WordPair {
  word: string;
  translation: string;
  pronunciation?: string;
  imageUrl?: string;
  audioUrl?: string;
}

interface InlineCreateFlashcardSetFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  onCoinsUpdate?: () => void;
}

export default function InlineCreateFlashcardSetForm({
  onSuccess,
  onCancel,
  onCoinsUpdate,
}: InlineCreateFlashcardSetFormProps) {
  const [setName, setSetName] = useState("");
  const [fromLanguage, setFromLanguage] = useState("English");
  const [toLanguage, setToLanguage] = useState("Spanish");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
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
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(false);
  const [translateToOneWord, setTranslateToOneWord] = useState(true);
  const [translateToPhrase, setTranslateToPhrase] = useState(false);
  const [existingUniqueTagsCount, setExistingUniqueTagsCount] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [publicCode, setPublicCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const debounceTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const translatingRef = useRef<Set<number>>(new Set());

  const addWordPair = () => {
    const MAX_WORDS = 100;
    const currentValidCount = wordPairs.filter(
      (pair) => pair.word.trim() && pair.translation.trim()
    ).length;

    if (currentValidCount >= MAX_WORDS) {
      setError(`Maximum ${MAX_WORDS} words allowed per flashcard set`);
      return;
    }

    const remainingSlots = MAX_WORDS - wordPairs.length;
    const amountToAdd = Math.min(addAmount, remainingSlots);

    if (amountToAdd <= 0) {
      setError(`Maximum ${MAX_WORDS} words allowed per flashcard set`);
      return;
    }

    const newPairs = [
      ...wordPairs,
      ...Array.from({ length: amountToAdd }, () => ({
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

    // Respect user's translation mode settings
    // The API will detect if it's a phrase and translate the whole phrase accordingly
    const trimmedWord = word.trim();
    const usePhraseTranslation = translateToPhrase;
    const useWordTranslation = translateToOneWord;

    try {
      const response = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: trimmedWord,
          fromLanguage,
          toLanguage,
          translateToOneWord: useWordTranslation,
          translateToPhrase: usePhraseTranslation,
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

  // Fetch existing unique tags count
  useEffect(() => {
    const fetchUniqueTagsCount = async () => {
      try {
        const response = await fetch("/api/flashcard-sets");
        if (response.ok) {
          const data = await response.json();
          const flashcardSets = data.flashcardSets || [];

          // Collect all unique tags from existing sets
          const existingUniqueTags = new Set<string>();
          flashcardSets.forEach((set: { tags?: string[] }) => {
            const setTags = set.tags || [];
            setTags.forEach((tag: string) => {
              if (tag.trim()) {
                existingUniqueTags.add(tag.trim());
              }
            });
          });

          setExistingUniqueTagsCount(existingUniqueTags.size);
        }
      } catch (error) {
        console.error("Error fetching unique tags count:", error);
      }
    };

    fetchUniqueTagsCount();
  }, []);

  // Generate preview code when public toggle is activated
  useEffect(() => {
    const generatePreviewCode = async () => {
      if (isPublic && !publicCode) {
        setGeneratingCode(true);
        try {
          const response = await fetch("/api/flashcard-sets/generate-code");
          if (response.ok) {
            const data = await response.json();
            setPublicCode(data.code);
          }
        } catch (err) {
          console.error("Error generating preview code:", err);
        } finally {
          setGeneratingCode(false);
        }
      } else if (!isPublic) {
        setPublicCode(null);
      }
    };

    generatePreviewCode();
  }, [isPublic, publicCode]);

  const handleWordsCreatedFromOCR = (newWordPairs: WordPair[]) => {
    setWordPairs((prev) => {
      const updated = [...prev];
      let newPairsIndex = 0;

      // First, fill empty slots (where both word and translation are empty)
      for (
        let i = 0;
        i < updated.length && newPairsIndex < newWordPairs.length;
        i++
      ) {
        if (!updated[i].word.trim() && !updated[i].translation.trim()) {
          updated[i] = newWordPairs[newPairsIndex];
          newPairsIndex++;
        }
      }

      // Then, append any remaining new word pairs
      const remainingPairs = newWordPairs.slice(newPairsIndex);
      return [...updated, ...remainingPairs];
    });
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

    const MAX_WORDS = 100;
    if (validPairs.length > MAX_WORDS) {
      setError(`Maximum ${MAX_WORDS} words allowed per flashcard set`);
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
          tags,
          words: validPairs,
          isPublic,
          previewCode: publicCode, // Send the preview code so it stays the same
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create flashcard set");
      }

      const data = await response.json();
      // If set was made public, show the code
      if (isPublic && data.flashcardSet?.publicCode) {
        setPublicCode(data.flashcardSet.publicCode);
        // Don't close immediately, show the code first
        setTimeout(() => {
          onSuccess();
          // Reset form
          setSetName("");
          setFromLanguage("English");
          setToLanguage("Spanish");
          setWordPairs(
            Array.from({ length: 5 }, () => ({ word: "", translation: "" }))
          );
          setIsPublic(false);
          setPublicCode(null);
        }, 3000); // Close after 3 seconds
      } else {
        onSuccess();
        // Reset form
        setSetName("");
        setFromLanguage("English");
        setToLanguage("Spanish");
        setWordPairs(
          Array.from({ length: 5 }, () => ({ word: "", translation: "" }))
        );
        setIsPublic(false);
      }
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
            maxLength={20}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Public Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Make Public
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Share this flashcard set with others using a unique code
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isPublic ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isPublic ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {generatingCode && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-600 rounded-lg">
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400"
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
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Generating public code...
                </p>
              </div>
            </div>
          )}
          {publicCode && !generatingCode && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded-lg">
              <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                Your public code:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 text-lg font-mono font-bold text-green-800 dark:text-green-200 bg-white dark:bg-gray-800 border-2 border-green-400 dark:border-green-600 rounded-lg text-center tracking-widest">
                  {publicCode}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(publicCode);
                  }}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs font-medium"
                  title="Copy to clipboard"
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Share this code with others so they can join your flashcard set!
              </p>
            </div>
          )}
        </div>

        {/* From and To Languages */}
        <LanguageSelectors
          fromLanguage={fromLanguage}
          toLanguage={toLanguage}
          onFromLanguageChange={setFromLanguage}
          onToLanguageChange={setToLanguage}
        />

        {/* Tags */}
        <TagsInput
          tags={tags}
          tagInput={tagInput}
          onTagInputChange={setTagInput}
          onAddTag={() => {
            const trimmed = tagInput.trim();
            if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
              setTags([...tags, trimmed]);
              setTagInput("");
            }
          }}
          onRemoveTag={(index) => setTags(tags.filter((_, i) => i !== index))}
          existingUniqueTagsCount={existingUniqueTagsCount}
        />

        {/* AI Help Section */}
        <AIHelpSection
          aiHelpEnabled={aiHelpEnabled}
          onToggleAIHelp={() => setAiHelpEnabled(!aiHelpEnabled)}
          autoTranslateEnabled={autoTranslateEnabled}
          onToggleAutoTranslate={toggleAutoTranslate}
          translateToOneWord={translateToOneWord}
          onToggleTranslateToOneWord={() =>
            setTranslateToOneWord(!translateToOneWord)
          }
          translateToPhrase={translateToPhrase}
          onToggleTranslateToPhrase={() =>
            setTranslateToPhrase(!translateToPhrase)
          }
          onTranslateAll={() => {
            wordPairs.forEach((pair, idx) => {
              if (
                pair.word.trim() &&
                !pair.translation.trim() &&
                !translatingRef.current.has(idx)
              ) {
                translateWord(pair.word, idx, false);
              }
            });
          }}
          translatingIndex={translatingIndex}
        />

        {/* Image Upload OCR */}
        <ImageUploadOCR
          onWordsCreated={handleWordsCreatedFromOCR}
          fromLanguage={fromLanguage}
          toLanguage={toLanguage}
          translateToOneWord={translateToOneWord}
          translateToPhrase={translateToPhrase}
          aiHelpEnabled={aiHelpEnabled}
          onCoinsUpdate={onCoinsUpdate}
          onError={setError}
        />

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
          className="w-full px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Words and Translations
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {
                wordPairs.filter(
                  (pair) => pair.word.trim() && pair.translation.trim()
                ).length
              }{" "}
              / 100 words
            </span>
          </div>
          <div className="space-y-2.5">
            {wordPairs.map((pair, index) => (
              <div
                key={index}
                className={`flex flex-col gap-2 items-start p-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-all duration-300 ${
                  deletingIndex === index
                    ? "opacity-0 scale-95 -translate-x-4 pointer-events-none"
                    : "opacity-100 scale-100 translate-x-0"
                }`}
              >
                <div className="flex gap-2 items-start w-full">
                  <div className="flex-1 grid grid-cols-2 gap-2.5">
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
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
                        className="px-2.5 py-1.5 text-xs border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
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
                        className="px-2.5 py-1.5 text-xs border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full transition-colors"
                      />
                      {translatingIndex === index && (
                        <div className="absolute right-2 top-[calc(50%+0.5rem)] -translate-y-1/2">
                          <svg
                            className="animate-spin h-3 w-3 text-blue-500"
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
                  <div className="flex gap-1 items-center">
                    {aiHelpEnabled && pair.word.trim() && (
                      <button
                        type="button"
                        onClick={() => handleRegenerateTranslation(index)}
                        disabled={translatingIndex === index}
                        className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                        title="Regenerate translation"
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
                      className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer active:scale-95"
                      title="More options"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${
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
                </div>
                {expandedIndices.has(index) && (
                  <div className="w-full mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3 opacity-80">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Pronunciation
                      </label>
                      <div className="flex gap-1.5 items-center">
                        {aiHelpEnabled && pair.translation.trim() && (
                          <button
                            type="button"
                            onClick={() => generatePronunciation(index)}
                            disabled={generatingPronunciationIndex === index}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            title="Generate pronunciation"
                          >
                            {generatingPronunciationIndex === index ? (
                              <svg
                                className="animate-spin h-3.5 w-3.5"
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
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Image
                        </label>
                        <label className="flex items-center justify-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors text-xs">
                          <svg
                            className="w-3 h-3 mr-1"
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
                          <span className="text-xs">
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
                          <div className="mt-1 relative">
                            <div className="w-full max-w-xl mx-auto">
                              <div className="relative w-full h-[380px] rounded-2xl overflow-hidden border-2 border-gray-300 dark:border-gray-600 shadow-lg">
                                <Image
                                  src={pair.imageUrl}
                                  alt="Word image preview"
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                                <div className="absolute inset-0 bg-black/40 dark:bg-black/60"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <p className="text-white text-xs font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] px-2 text-center">
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
                                  className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg z-10"
                                >
                                  <svg
                                    className="w-3 h-3"
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
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Voice
                        </label>
                        <label className="flex items-center justify-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors text-xs">
                          <svg
                            className="w-3 h-3 mr-1"
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
                          <span className="text-xs">
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
                          <div className="mt-1">
                            <audio controls className="w-full h-6">
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
                              className="mt-0.5 text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
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
            disabled={wordPairs.length >= 100}
            className="mt-1.5 w-full px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
            {loading
              ? "Creating..."
              : (() => {
                  const validPairs = wordPairs.filter(
                    (pair) => pair.word.trim() && pair.translation.trim()
                  );
                  const count = validPairs.length;
                  return `Create Set${
                    count > 0
                      ? ` (${count} ${
                          count === 1 ? "flashcard" : "flashcards"
                        })`
                      : ""
                  }`;
                })()}
          </button>
        </div>
      </form>
    </div>
  );
}
