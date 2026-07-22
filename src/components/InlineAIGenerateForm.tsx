"use client";

import { useMemo, useState, useEffect } from "react";
import { COIN_COSTS } from "@/lib/coin-costs";
import { getLanguageLabel, LANGUAGES } from "@/lib/languages";
import { useI18n } from "@/i18n/I18nProvider";
import { apiFetch } from "@/lib/apiUrl";

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
  const { t, locale } = useI18n();
  const [level, setLevel] = useState("A1");
  const [topic, setTopic] = useState("");
  const [fromLanguage, setFromLanguage] = useState("English");
  const [toLanguage, setToLanguage] = useState("Spanish");
  const [wordCount, setWordCount] = useState(5);
  const [setName, setSetName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [existingUniqueTagsCount, setExistingUniqueTagsCount] = useState(0);
  const [includeImage, setIncludeImage] = useState(false);
  const [includeVoice, setIncludeVoice] = useState(false);
  const [includePronunciation, setIncludePronunciation] = useState(false);
  const [onlyNewWords, setOnlyNewWords] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [publicCode, setPublicCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
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

  // Fetch existing unique tags count
  useEffect(() => {
    const fetchUniqueTagsCount = async () => {
      try {
        const response = await apiFetch("/flashcard-sets");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!topic.trim()) {
      setError(t("createSet.topicRequired"));
      return;
    }

    if (!setName.trim()) {
      setError(t("createSet.nameRequired"));
      return;
    }

    if (fromLanguage === toLanguage) {
      setError(t("createSet.languagesDifferent"));
      return;
    }

    if (wordCount < 1 || wordCount > 10) {
      setError(t("createSet.wordCountRange"));
      return;
    }

    if (tags.length > 5) {
      setError(t("createSet.maximumTags", { count: 5 }));
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
          tags,
          includeImage,
          includeVoice,
          includePronunciation,
          onlyNewWords,
          isPublic,
          previewCode: publicCode, // Send the preview code so it stays the same
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate flashcards");
      }

      const data = await response.json();
      // If set was made public, show the code
      if (isPublic && data.flashcardSet?.publicCode) {
        setPublicCode(data.flashcardSet.publicCode);
        // Don't close immediately, show the code first
        setTimeout(() => {
          onSuccess();
          // Reset form
          setTopic("");
          setSetName("");
          setTags([]);
          setTagInput("");
          setWordCount(5);
          setLevel("A1");
          setFromLanguage("English");
          setToLanguage("Spanish");
          setIncludeImage(false);
          setIncludeVoice(false);
          setIncludePronunciation(false);
          setIsPublic(false);
          setPublicCode(null);
        }, 3000); // Close after 3 seconds
      } else {
        onSuccess();
        // Reset form
        setTopic("");
        setSetName("");
        setTags([]);
        setTagInput("");
        setWordCount(5);
        setLevel("A1");
        setFromLanguage("English");
        setToLanguage("Spanish");
        setIncludeImage(false);
        setIncludeVoice(false);
        setIncludePronunciation(false);
        setIsPublic(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate flashcards"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-purple-500 dark:border-purple-400 p-4"
      aria-busy={loading}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <svg
            className="animate-spin h-12 w-12 text-purple-600 dark:text-purple-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
            {t("createSet.generatingFlashcards")}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("createSet.pleaseWait")}
          </p>
        </div>
      )}

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
          {t("createSet.aiTitle")}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <fieldset disabled={loading} className="space-y-3 border-0 p-0 m-0 min-w-0 disabled:opacity-100">
        {/* Set Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("createSet.setName")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder={t("createSet.aiSetNamePlaceholder")}
            maxLength={20}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
            required
          />
        </div>

        {/* Topic */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("createSet.topic")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("createSet.topicPlaceholder")}
            maxLength={20}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
            required
          />
        </div>

        {/* Level */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("createSet.cefrLevel")} <span className="text-red-500">*</span>
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
              {t("createSet.fromLanguage")} <span className="text-red-500">*</span>
            </label>
            <select
              value={fromLanguage}
              onChange={(e) => setFromLanguage(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
              required
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {getLanguageLabel(lang.value, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("createSet.toLanguage")} <span className="text-red-500">*</span>
            </label>
            <select
              value={toLanguage}
              onChange={(e) => setToLanguage(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
              required
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {getLanguageLabel(lang.value, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("createSet.tagsLabel", { max: 5, count: tags.length })}
          </label>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            {t("createSet.tagsLimitHint", { count: existingUniqueTagsCount })}
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs flex items-center gap-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((_, i) => i !== index))}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = tagInput.trim();
                  if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
                    setTags([...tags, trimmed]);
                    setTagInput("");
                  }
                }
              }}
              placeholder={
                tags.length >= 5
                  ? t("createSet.tagsMaxPlaceholder", { max: 5 })
                  : t("createSet.tagPlaceholder")
              }
              maxLength={20}
              disabled={tags.length >= 5}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = tagInput.trim();
                if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
                  setTags([...tags, trimmed]);
                  setTagInput("");
                }
              }}
              disabled={tags.length >= 5}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("createSet.add")}
            </button>
          </div>
        </div>

        {/* Word Count */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t("createSet.numberOfFlashcards")} <span className="text-red-500">*</span>
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
            {t("createSet.flashcardsRange")}
          </p>
        </div>

        {/* Additional Features */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("createSet.additionalFeatures")}
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
              {t("createSet.image")}
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
              {t("createSet.voice")}
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
              {t("createSet.pronunciation")}
            </button>

            {/* Only New Words Toggle */}
            <button
              type="button"
              onClick={() => setOnlyNewWords(!onlyNewWords)}
              title={t("createSet.onlyNewWordsHint")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                onlyNewWords
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t("createSet.onlyNewWords")}
            </button>
          </div>
        </div>

        {/* Public Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("createSet.makePublic")}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("createSet.publicHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                isPublic ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-700"
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
                  {t("createSet.generatingPublicCode")}
                </p>
              </div>
            </div>
          )}
          {publicCode && !generatingCode && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded-lg">
              <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                {t("createSet.yourPublicCode")}
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
                  title={t("createSet.copyToClipboard")}
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
                {t("createSet.publicCodeHint")}
              </p>
            </div>
          )}
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
                {t("createSet.totalCost")}
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-300">
                {t("createSet.totalCoins", { count: totalCost })}
              </div>
            </div>
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300 bg-white/80 dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-purple-300 dark:border-purple-700">
            <div className="font-semibold mb-1.5 text-purple-800 dark:text-purple-200">
              {t("createSet.costBreakdown")}
            </div>
            <div className="space-y-1">
              <div className="font-medium">{t("createSet.baseCostLine", { count: wordCount, unit: COIN_COSTS.WORD_TRANSLATION, total: wordCount * COIN_COSTS.WORD_TRANSLATION })}</div>
              {includeImage && (
                <div className="font-medium">{t("createSet.imageCostLine", { count: wordCount, unit: COIN_COSTS.IMAGE_GENERATION, total: wordCount * COIN_COSTS.IMAGE_GENERATION })}</div>
              )}
              {includePronunciation && (
                <div className="font-medium">{t("createSet.pronunciationCostLine", { count: wordCount, unit: COIN_COSTS.PRONUNCIATION_GENERATION, total: wordCount * COIN_COSTS.PRONUNCIATION_GENERATION })}</div>
              )}
              {includeVoice && (
                <div className="font-medium">{t("createSet.audioCostLine", { count: wordCount, unit: COIN_COSTS.AUDIO_GENERATION, total: wordCount * COIN_COSTS.AUDIO_GENERATION })}</div>
              )}
              {!includeImage && !includeVoice && !includePronunciation && (
                <div className="text-purple-600 dark:text-purple-400 italic text-xs">
                  {t("createSet.noAdditionalFeatures")}
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
            className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs cursor-pointer active:scale-[0.98] disabled:cursor-not-allowed"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer active:scale-[0.98] disabled:active:scale-100"
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
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {t("createSet.generate")}
          </button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
