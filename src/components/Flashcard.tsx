"use client";

import { useState } from "react";

interface FlashcardProps {
  word: string;
  translation: string;
  onNext: () => void;
  onKnow: () => void;
  onDontKnow: () => void;
}

export default function Flashcard({
  word,
  translation,
  onNext,
  onKnow,
  onDontKnow,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Flashcard */}
      <div className="perspective-1000 mb-8">
        <div
          className={`relative w-full h-96 transition-transform duration-500 transform-style-3d cursor-pointer ${
            isFlipped ? "rotate-y-180" : ""
          }`}
          onClick={handleFlip}
        >
          {/* Front */}
          <div
            className={`absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex items-center justify-center backface-hidden ${
              isFlipped ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="text-center p-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">
                Word
              </p>
              <h2 className="text-5xl font-bold text-gray-900 dark:text-white">
                {word}
              </h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-8">
                Click to reveal translation
              </p>
            </div>
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl flex items-center justify-center backface-hidden rotate-y-180 ${
              isFlipped ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="text-center p-8">
              <p className="text-sm text-blue-100 mb-4 uppercase tracking-wide">
                Translation
              </p>
              <h2 className="text-5xl font-bold text-white">{translation}</h2>
              <p className="text-sm text-blue-200 mt-8">
                Click to see the word again
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isFlipped && (
        <div className="flex gap-4 justify-center animate-fadeIn">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDontKnow();
              setIsFlipped(false);
            }}
            className="flex-1 max-w-xs bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            Still Learning
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKnow();
              setIsFlipped(false);
            }}
            className="flex-1 max-w-xs bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            I Know This!
          </button>
        </div>
      )}

      {!isFlipped && (
        <div className="flex justify-center">
          <button
            onClick={onNext}
            className="px-8 py-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold transition-all"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

