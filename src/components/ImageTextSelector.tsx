"use client";

import { useMemo } from "react";

interface ImageTextSelectorProps {
  text: string;
  selectedWords: Set<string>;
  onWordToggle: (word: string) => void;
}

export default function ImageTextSelector({
  text,
  selectedWords,
  onWordToggle,
}: ImageTextSelectorProps) {
  // Split text into words while preserving spaces and punctuation
  const words = useMemo(() => {
    // Split by whitespace but keep the whitespace and punctuation
    const parts: Array<{ text: string; isWord: boolean }> = [];
    const regex = /(\S+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the word
      if (match.index > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.index),
          isWord: false,
        });
      }
      // Add the word
      parts.push({
        text: match[0],
        isWord: true,
      });
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        isWord: false,
      });
    }

    return parts;
  }, [text]);

  return (
    <div className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        Click on words to select them for flashcards
      </div>
      <div className="text-base leading-relaxed text-gray-900 dark:text-white whitespace-pre-wrap break-words">
        {words.map((part, index) => {
          if (!part.isWord) {
            return <span key={index}>{part.text}</span>;
          }

          // Check if word is selected (case-insensitive comparison)
          const isSelected = Array.from(selectedWords).some(
            (w) => w.toLowerCase() === part.text.toLowerCase()
          );
          return (
            <span
              key={index}
              onClick={() => onWordToggle(part.text)}
              className={`inline-block px-1 py-0.5 mx-0.5 rounded cursor-pointer transition-all ${
                isSelected
                  ? "bg-blue-500 text-white font-semibold shadow-md"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:shadow-sm"
              }`}
              title={isSelected ? "Click to deselect" : "Click to select"}
            >
              {part.text}
            </span>
          );
        })}
      </div>
      {selectedWords.size > 0 && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {selectedWords.size} word{selectedWords.size !== 1 ? "s" : ""}{" "}
          selected
        </div>
      )}
    </div>
  );
}
