"use client";

import { useState, useEffect } from "react";

interface FlashcardProps {
  word: string;
  translation: string;
  difficulty: number;
  pronunciation?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export default function Flashcard({
  word,
  translation,
  difficulty,
  pronunciation,
  imageUrl,
  audioUrl,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip when word or translation changes to ensure we always start with English side
  useEffect(() => {
    setIsFlipped(false);
  }, [word, translation]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch((err) => {
        console.error("Error playing audio:", err);
      });
    }
  };

  const difficultyConfig = {
    1: {
      bg: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30",
      border: "border-green-300 dark:border-green-700",
      accent: "text-green-600 dark:text-green-400",
      accentBg: "bg-green-600 dark:bg-green-400",
    },
    2: {
      bg: "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30",
      border: "border-yellow-300 dark:border-yellow-700",
      accent: "text-yellow-600 dark:text-yellow-400",
      accentBg: "bg-yellow-600 dark:bg-yellow-400",
    },
    3: {
      bg: "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30",
      border: "border-orange-300 dark:border-orange-700",
      accent: "text-orange-600 dark:text-orange-400",
      accentBg: "bg-orange-600 dark:bg-orange-400",
    },
    4: {
      bg: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30",
      border: "border-red-300 dark:border-red-700",
      accent: "text-red-600 dark:text-red-400",
      accentBg: "bg-red-600 dark:bg-red-400",
    },
  };

  const config =
    difficultyConfig[difficulty as keyof typeof difficultyConfig] ||
    difficultyConfig[1];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-4 py-6">
      {/* Flashcard */}
      <div className="w-full max-w-xl">
        {/* Image above flashcard */}
        {imageUrl && (
          <div className="mb-4 rounded-xl overflow-hidden shadow-lg">
            <img
              src={imageUrl}
              alt={translation}
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Flashcard Card */}
        <div
          key={`card-${word}-${translation}`}
          className={`relative w-full h-[380px] perspective-1000 cursor-pointer`}
          onClick={handleFlip}
        >
          <div
            className={`relative w-full h-full preserve-3d transition-transform duration-500 ${
              isFlipped ? "rotate-y-180" : ""
            }`}
          >
            {/* Front side */}
            <div
              className={`absolute inset-0 backface-hidden ${config.bg} ${config.border} rounded-2xl shadow-2xl border-2 flex flex-col items-center justify-center p-8`}
            >
              {/* Sound button - top right */}
              {audioUrl && (
                <button
                  onClick={handlePlayAudio}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all z-10 hover:scale-110 active:scale-95"
                  title="Play pronunciation"
                >
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
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                </button>
              )}

              <div className="text-center w-full">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`w-2 h-2 rounded-full ${config.accentBg} mr-2`}
                  ></div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${config.accent}`}
                  >
                    Word
                  </p>
                  <div
                    className={`w-2 h-2 rounded-full ${config.accentBg} ml-2`}
                  ></div>
                </div>
                <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                  {word}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 font-medium">
                  Click to reveal translation
                </p>
              </div>
            </div>

            {/* Back side */}
            <div
              className={`absolute inset-0 backface-hidden rotate-y-180 ${config.bg} ${config.border} rounded-2xl shadow-2xl border-2 flex flex-col items-center justify-center p-8`}
            >
              {/* Sound button - top right */}
              {audioUrl && (
                <button
                  onClick={handlePlayAudio}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all z-10 hover:scale-110 active:scale-95"
                  title="Play pronunciation"
                >
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
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                </button>
              )}

              <div className="text-center w-full">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`w-2 h-2 rounded-full ${config.accentBg} mr-2`}
                  ></div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${config.accent}`}
                  >
                    Translation
                  </p>
                  <div
                    className={`w-2 h-2 rounded-full ${config.accentBg} ml-2`}
                  ></div>
                </div>
                <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                  {translation}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 font-medium">
                  Click to flip back
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pronunciation below flashcard */}
        {pronunciation && (
          <div className="mt-4 text-center">
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                Pronunciation:
              </span>
              <span className="text-purple-600 dark:text-purple-400">
                {pronunciation}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFlipped(false);
            onPrevious();
          }}
          disabled={!hasPrevious}
          className="px-8 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl active:scale-95"
        >
          Previous
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFlipped(false);
            onNext();
          }}
          disabled={!hasNext}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl active:scale-95"
        >
          Next
        </button>
      </div>
    </div>
  );
}
