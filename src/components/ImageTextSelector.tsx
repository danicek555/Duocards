"use client";

import { useMemo, useState } from "react";

interface ImageTextSelectorProps {
  text: string;
  selectedWordIndices: Set<number>;
  usedWordIndices?: Set<number>;
  onWordToggle: (index: number, word: string) => void;
  onPhraseSelect?: (phrase: string, indices: number[]) => void;
}

type SelectionMode = "words" | "phrases" | "clear";

export default function ImageTextSelector({
  text,
  selectedWordIndices,
  usedWordIndices = new Set(),
  onWordToggle,
  onPhraseSelect,
}: ImageTextSelectorProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("words");
  const [phraseSelection, setPhraseSelection] = useState<number[]>([]);
  const [createdPhrases, setCreatedPhrases] = useState<Set<number>>(new Set());
  const [phraseGroups, setPhraseGroups] = useState<number[][]>([]);

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

  const handleWordClick = (index: number) => {
    if (!words[index].isWord) return;

    // Clear mode - allow removing selected words/phrases
    if (selectionMode === "clear") {
      // Check if word is part of a created phrase - remove entire phrase
      const phraseGroup = phraseGroups.find((group) => group.includes(index));
      if (phraseGroup) {
        // Remove entire phrase from selected words
        phraseGroup.forEach((idx) => {
          if (selectedWordIndices.has(idx)) {
            onWordToggle(idx, words[idx].text);
          }
        });
        // Remove from created phrases tracking
        setCreatedPhrases((prev) => {
          const newSet = new Set(prev);
          phraseGroup.forEach((idx) => newSet.delete(idx));
          return newSet;
        });
        // Remove from phrase groups
        setPhraseGroups((prev) =>
          prev.filter((group) => !group.includes(index))
        );
        return;
      }

      // Remove single word from selected words
      if (selectedWordIndices.has(index)) {
        onWordToggle(index, words[index].text);
      }
      // Remove from phrase selection if in phrase selection
      if (phraseSelection.includes(index)) {
        setPhraseSelection((prev) => prev.filter((i) => i !== index));
      }
      return;
    }

    // Check if word is part of a created phrase - if so, don't allow selection
    if (createdPhrases.has(index)) {
      return; // Word is part of a phrase, can't select individually
    }

    // Check if word is already selected - don't allow deselection in normal modes
    if (selectedWordIndices.has(index)) {
      return; // Already selected, can't click to deselect (use Clear mode)
    }

    if (selectionMode === "words") {
      // Single word selection mode - pass index and word text
      onWordToggle(index, words[index].text);
    } else {
      // Phrase selection mode
      setPhraseSelection((prev) => {
        if (prev.includes(index)) {
          // Deselect if already selected
          return prev.filter((i) => i !== index);
        } else {
          // Add to selection (only consecutive words)
          if (prev.length === 0) {
            return [index];
          }

          // Sort existing selection
          const sorted = [...prev].sort((a, b) => a - b);
          const minIndex = sorted[0];
          const maxIndex = sorted[sorted.length - 1];

          // Check if the new index is adjacent to the selection
          // Find all word indices to check adjacency
          const wordIndices: number[] = [];
          words.forEach((part, idx) => {
            if (part.isWord) wordIndices.push(idx);
          });

          const isAdjacentToStart =
            wordIndices.indexOf(index) === wordIndices.indexOf(minIndex) - 1;
          const isAdjacentToEnd =
            wordIndices.indexOf(index) === wordIndices.indexOf(maxIndex) + 1;

          if (isAdjacentToStart || isAdjacentToEnd) {
            // Add to selection
            return [...sorted, index].sort((a, b) => a - b);
          } else {
            // Start new selection
            return [index];
          }
        }
      });
    }
  };

  const handleCreatePhrase = () => {
    if (phraseSelection.length > 0 && onPhraseSelect) {
      const sortedIndices = phraseSelection.sort((a, b) => a - b);
      const phrase = sortedIndices.map((idx) => words[idx].text).join(" ");
      onPhraseSelect(phrase, sortedIndices);

      // Mark these words as part of a created phrase
      setCreatedPhrases((prev) => {
        const newSet = new Set(prev);
        sortedIndices.forEach((idx) => newSet.add(idx));
        return newSet;
      });

      // Add to phrase groups for continuous rendering
      setPhraseGroups((prev) => [...prev, sortedIndices]);

      setPhraseSelection([]);
    }
  };

  const handleClearPhraseSelection = () => {
    setPhraseSelection([]);
  };

  return (
    <div className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-gray-200 dark:border-gray-700">
      {/* Mode Selection */}
      <div className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Mode:
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="selectionMode"
              value="words"
              checked={selectionMode === "words"}
              onChange={() => {
                setSelectionMode("words");
                setPhraseSelection([]);
              }}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Words
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="selectionMode"
              value="phrases"
              checked={selectionMode === "phrases"}
              onChange={() => {
                setSelectionMode("phrases");
                setPhraseSelection([]);
              }}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Phrases
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="selectionMode"
              value="clear"
              checked={selectionMode === "clear"}
              onChange={() => {
                setSelectionMode("clear");
                setPhraseSelection([]);
              }}
              className="w-4 h-4 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Clear
            </span>
          </label>
        </div>
        {selectionMode === "phrases" && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Click words to build a phrase, then click "Create Phrase" to add it
          </div>
        )}
        {selectionMode === "clear" && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Click on selected words or phrases to remove them
          </div>
        )}
      </div>

      {/* Phrase Selection Actions */}
      {selectionMode === "phrases" && phraseSelection.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={handleCreatePhrase}
            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Create Phrase ({phraseSelection.length} word
            {phraseSelection.length !== 1 ? "s" : ""})
          </button>
          <button
            onClick={handleClearPhraseSelection}
            className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Text Display */}
      <div className="text-base leading-relaxed text-gray-900 dark:text-white whitespace-pre-wrap wrap-break-word">
        {words.map((part, index) => {
          if (!part.isWord) {
            // Check if this space/punctuation is between words being selected for a phrase (purple)
            const isBetweenPhraseWords = (() => {
              if (phraseSelection.length < 2) return false;
              const sorted = [...phraseSelection].sort((a, b) => a - b);
              for (let i = 0; i < sorted.length - 1; i++) {
                if (index > sorted[i] && index < sorted[i + 1]) {
                  return true;
                }
              }
              return false;
            })();

            // Check if between words in created phrases (gray/shadowed)
            const isBetweenCreatedPhraseWords = phraseGroups.some((group) => {
              const sorted = group.sort((a, b) => a - b);
              for (let i = 0; i < sorted.length - 1; i++) {
                if (index > sorted[i] && index < sorted[i + 1]) {
                  return true;
                }
              }
              return false;
            });

            // Check if this space is between words in a used phrase (check usedWordIndices)
            const isBetweenUsedPhraseWords = (() => {
              // Find consecutive used word indices
              const usedIndices = Array.from(usedWordIndices).sort(
                (a, b) => a - b
              );
              for (let i = 0; i < usedIndices.length - 1; i++) {
                if (index > usedIndices[i] && index < usedIndices[i + 1]) {
                  // Check if these are consecutive word indices (not separated by other words)
                  const wordIndices: number[] = [];
                  words.forEach((w, idx) => {
                    if (w.isWord) wordIndices.push(idx);
                  });
                  const wordIdx1 = wordIndices.indexOf(usedIndices[i]);
                  const wordIdx2 = wordIndices.indexOf(usedIndices[i + 1]);
                  if (wordIdx2 === wordIdx1 + 1) {
                    return true;
                  }
                }
              }
              return false;
            })();

            return (
              <span
                key={index}
                className={
                  isBetweenPhraseWords
                    ? "bg-green-500 dark:bg-green-600 text-white"
                    : isBetweenCreatedPhraseWords
                    ? "bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 opacity-50"
                    : isBetweenUsedPhraseWords
                    ? "bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 opacity-50"
                    : ""
                }
              >
                {part.text}
              </span>
            );
          }

          // Check if this specific word index is selected
          const isSelected = selectedWordIndices.has(index);
          // Check if this specific word index has been used
          const isUsed = usedWordIndices.has(index);
          const isInPhraseSelection = phraseSelection.includes(index);
          const isInCreatedPhrase = createdPhrases.has(index);

          // Check if this word is at the start, middle, or end of a phrase group
          const phraseGroup = phraseGroups.find((group) =>
            group.includes(index)
          );
          const isPhraseStart =
            phraseGroup && phraseGroup.sort((a, b) => a - b)[0] === index;
          const isPhraseEnd =
            phraseGroup &&
            phraseGroup.sort((a, b) => a - b)[phraseGroup.length - 1] === index;
          const isPhraseMiddle = phraseGroup && !isPhraseStart && !isPhraseEnd;

          return (
            <span
              key={index}
              onClick={() => {
                if (!isUsed) {
                  handleWordClick(index);
                }
              }}
              style={{
                cursor: isUsed
                  ? "not-allowed"
                  : selectionMode === "clear" &&
                    (isSelected || isInCreatedPhrase || isInPhraseSelection)
                  ? "pointer"
                  : selectionMode !== "clear" &&
                    (isSelected || isInCreatedPhrase)
                  ? "default"
                  : "pointer",
              }}
              className={`inline-block px-1 py-0.5 transition-all select-none ${
                isUsed
                  ? `bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 opacity-50 cursor-not-allowed ${
                      isPhraseStart ? "rounded-l-md ml-0.5" : ""
                    } ${isPhraseEnd ? "rounded-r-md mr-0.5" : ""} ${
                      isPhraseMiddle ? "rounded-none" : ""
                    } ${
                      !isPhraseStart && !isPhraseEnd && !isPhraseMiddle
                        ? "rounded-md mx-0.5"
                        : ""
                    }`
                  : isInCreatedPhrase
                  ? `bg-purple-500 dark:bg-purple-600 text-white font-semibold shadow-md cursor-pointer ${
                      isPhraseStart ? "rounded-l-md ml-0.5" : ""
                    } ${isPhraseEnd ? "rounded-r-md mr-0.5" : ""} ${
                      isPhraseMiddle ? "rounded-none" : ""
                    } ${
                      !isPhraseStart && !isPhraseEnd && !isPhraseMiddle
                        ? "rounded-md mx-0.5"
                        : ""
                    }`
                  : isInPhraseSelection
                  ? `bg-green-500 dark:bg-green-600 text-white font-semibold shadow-md cursor-pointer ${
                      isPhraseStart ? "rounded-l-md ml-0.5" : ""
                    } ${isPhraseEnd ? "rounded-r-md mr-0.5" : ""} ${
                      isPhraseMiddle ? "rounded-none" : ""
                    } ${
                      !isPhraseStart && !isPhraseEnd && !isPhraseMiddle
                        ? "rounded-md mx-0.5"
                        : ""
                    }`
                  : isSelected
                  ? "bg-blue-500 dark:bg-blue-600 text-white font-semibold shadow-md rounded-md mx-0.5 cursor-pointer"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:shadow-sm rounded-md mx-0.5 cursor-pointer"
              }`}
              title={
                selectionMode === "clear"
                  ? isSelected || isInCreatedPhrase || isInPhraseSelection
                    ? "Click to remove"
                    : "Not selected"
                  : selectionMode === "words"
                  ? isSelected
                    ? "Already selected (use Clear mode to remove)"
                    : "Click to select"
                  : isInPhraseSelection
                  ? "Click to remove from phrase"
                  : "Click to add to phrase"
              }
            >
              {part.text}
            </span>
          );
        })}
      </div>
      {selectedWordIndices.size > 0 && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {selectedWordIndices.size} word
          {selectedWordIndices.size !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );
}
