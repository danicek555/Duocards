"use client";

import { useState, useEffect } from "react";

interface FlashcardProps {
  word: string;
  translation: string;
  difficulty: number;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export default function Flashcard({
  word,
  translation,
  difficulty,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip when word changes
  useEffect(() => {
    setIsFlipped(false);
  }, [word]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const difficultyColors = {
    1: "bg-green-100 border-green-300 dark:bg-green-900 dark:border-green-700",
    2: "bg-yellow-100 border-yellow-300 dark:bg-yellow-900 dark:border-yellow-700",
    3: "bg-orange-100 border-orange-300 dark:bg-orange-900 dark:border-orange-700",
    4: "bg-red-100 border-red-300 dark:bg-red-900 dark:border-red-700",
  };

  const difficultyColor = difficultyColors[difficulty as keyof typeof difficultyColors] || difficultyColors[1];

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* Flashcard */}
      <div
        className={`relative w-full max-w-md h-64 perspective-1000 cursor-pointer`}
        onClick={handleFlip}
      >
        <div
          className={`relative w-full h-full preserve-3d transition-transform duration-500 ${
            isFlipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Front side */}
          <div
            className={`absolute inset-0 backface-hidden ${difficultyColor} rounded-xl shadow-2xl border-2 flex items-center justify-center p-8`}
          >
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Word
              </p>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                {word}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Click to reveal translation
              </p>
            </div>
          </div>

          {/* Back side */}
          <div
            className={`absolute inset-0 backface-hidden rotate-y-180 ${difficultyColor} rounded-xl shadow-2xl border-2 flex items-center justify-center p-8`}
          >
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Translation
              </p>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                {translation}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Click to flip back
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFlipped(false);
            onPrevious();
          }}
          disabled={!hasPrevious}
          className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

