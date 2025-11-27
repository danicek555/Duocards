"use client";

import { useState } from "react";
import Image from "next/image";
import ImageTextSelector from "./ImageTextSelector";

interface WordPair {
  word: string;
  translation: string;
}

interface ImageUploadOCRProps {
  onWordsCreated: (wordPairs: WordPair[]) => void;
  fromLanguage: string;
  toLanguage: string;
  translateToOneWord: boolean;
  translateToPhrase: boolean;
  aiHelpEnabled: boolean;
  onCoinsUpdate?: () => void;
  onError?: (error: string) => void;
}

export default function ImageUploadOCR({
  onWordsCreated,
  fromLanguage,
  toLanguage,
  translateToOneWord,
  translateToPhrase,
  aiHelpEnabled,
  onCoinsUpdate,
  onError,
}: ImageUploadOCRProps) {
  const [imageUploadMode, setImageUploadMode] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [selectedWordIndices, setSelectedWordIndices] = useState<Set<number>>(
    new Set()
  );
  const [usedWordIndices, setUsedWordIndices] = useState<Set<number>>(
    new Set()
  );
  const [wordIndexToText, setWordIndexToText] = useState<Map<number, string>>(
    new Map()
  );
  const [extractingText, setExtractingText] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [translatingSelectedWords, setTranslatingSelectedWords] =
    useState(false);
  const [noTextAlert, setNoTextAlert] = useState(false);

  const handleImageUploadForOCR = async (file: File) => {
    // Validate file type - allow JPG, PNG, and HEIC
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/heic",
      "image/heif",
    ];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isHeic =
      fileExtension === "heic" ||
      fileExtension === "heif" ||
      file.type === "image/heic" ||
      file.type === "image/heif";
    const isValidType =
      allowedTypes.includes(file.type) ||
      fileExtension === "jpg" ||
      fileExtension === "jpeg" ||
      fileExtension === "png" ||
      isHeic;

    if (!isValidType) {
      onError?.("Only JPG, PNG, and HEIC images are allowed");
      return;
    }

    try {
      setProcessingImage(true);
      // Clear OCR text immediately when processing new image
      setExtractedText("");
      setSelectedWordIndices(new Set());
      setUsedWordIndices(new Set());
      setWordIndexToText(new Map());
      setNoTextAlert(false);
      let fileToProcess = file;
      let dataUrl: string;

      // Convert HEIC to JPEG for preview
      if (isHeic) {
        // Dynamically import heic2any to avoid SSR issues
        const heic2any = (await import("heic2any")).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });
        // heic2any returns an array, take the first result
        const blob = Array.isArray(convertedBlob)
          ? convertedBlob[0]
          : convertedBlob;
        fileToProcess = new File(
          [blob],
          file.name.replace(/\.heic?$/i, ".jpg"),
          {
            type: "image/jpeg",
          }
        );
      }

      // Convert to data URL for preview
      const reader = new FileReader();
      reader.onloadend = () => {
        dataUrl = reader.result as string;
        setUploadedImage(dataUrl);
        setExtractedText("");
        setSelectedWordIndices(new Set());
        setNoTextAlert(false);
        setProcessingImage(false);
      };
      reader.readAsDataURL(fileToProcess);
    } catch (error) {
      setProcessingImage(false);
      onError?.(
        error instanceof Error
          ? `Failed to process image: ${error.message}`
          : "Failed to process image"
      );
    }
  };

  // Resize image to reduce token usage (max 2048px on longest side)
  const resizeImageForOCR = async (
    imageDataUrl: string,
    maxDimension: number = 2048
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        // Create canvas and resize
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        resolve(resizedDataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageDataUrl;
    });
  };

  const extractTextFromImage = async () => {
    if (!uploadedImage) return;

    setExtractingText(true);
    setNoTextAlert(false);
    onError?.("");

    try {
      // Resize image before sending to reduce token usage
      // 2048px max dimension is optimal for OCR while minimizing tokens
      const resizedImageDataUrl = await resizeImageForOCR(uploadedImage, 2048);

      const response = await fetch("/api/extract-text-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: resizedImageDataUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.error || "Failed to extract text from image";

        // Show prominent alert if there's no text
        if (errorMessage === "There is no text in the picture") {
          setNoTextAlert(true);
        }

        onError?.(errorMessage);
        return;
      }

      const data = await response.json();
      setExtractedText(data.text);
      setNoTextAlert(false);

      // Refresh coins after successful extraction
      if (onCoinsUpdate) {
        onCoinsUpdate();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to extract text from image";
      onError?.(errorMessage);
    } finally {
      setExtractingText(false);
    }
  };

  const toggleWordSelection = (index: number, word: string) => {
    // Store the word text for this index
    setWordIndexToText((prev) => {
      const newMap = new Map(prev);
      newMap.set(index, word);
      return newMap;
    });

    setSelectedWordIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Calculate actual number of flashcards (phrases count as 1, words count as 1 each)
  // Uses the same grouping logic as handleCreateFlashcardsFromSelectedWords
  // Excludes words that are already used (already turned into flashcards)
  const calculateFlashcardCount = (): number => {
    if (selectedWordIndices.size === 0) return 0;

    // Filter out used words - they've already been turned into flashcards
    const availableIndices = Array.from(selectedWordIndices).filter(
      (idx) => !usedWordIndices.has(idx)
    );

    if (availableIndices.length === 0) return 0;

    // Extract all words from text to map indices to words
    const allWords: string[] = [];
    const regex = /(\S+)/g;
    let match;
    while ((match = regex.exec(extractedText)) !== null) {
      allWords.push(match[0]);
    }

    // Use the same two-pass logic as handleCreateFlashcardsFromSelectedWords
    const sortedIndices = availableIndices.sort((a, b) => a - b);
    const wordGroups: Array<{ indices: number[]; text: string }> = [];
    const processedIndices = new Set<number>();

    // First pass: Process created phrases (phrases stored in wordIndexToText)
    // Group indices that have the same phrase text (they're all part of the same phrase)
    const phraseMap = new Map<string, number[]>();

    for (const idx of sortedIndices) {
      if (processedIndices.has(idx)) continue;

      const storedText = wordIndexToText.get(idx);
      if (storedText && storedText.includes(" ")) {
        // This is a phrase - collect all indices that have this same phrase text
        if (!phraseMap.has(storedText)) {
          phraseMap.set(storedText, []);
        }
        phraseMap.get(storedText)!.push(idx);
      }
    }

    // Process each unique phrase
    for (const [phraseText, phraseIndices] of phraseMap.entries()) {
      // Sort the indices to get them in order
      const sortedPhraseIndices = phraseIndices.sort((a, b) => a - b);

      // Only process if we haven't already processed any of these indices
      if (sortedPhraseIndices.some((idx) => processedIndices.has(idx))) {
        continue;
      }

      // Create a group for this phrase with all its indices
      wordGroups.push({
        indices: [...sortedPhraseIndices],
        text: phraseText,
      });

      // Mark all indices in this phrase as processed
      sortedPhraseIndices.forEach((i) => processedIndices.add(i));
    }

    // Second pass: Process remaining individual words (not part of phrases)
    let currentGroup: number[] = [];
    for (const idx of sortedIndices) {
      if (processedIndices.has(idx)) continue;

      if (currentGroup.length === 0) {
        currentGroup = [idx];
      } else {
        const lastIdx = currentGroup[currentGroup.length - 1];
        // Check if indices are consecutive (next word in the array)
        if (idx === lastIdx + 1) {
          currentGroup.push(idx);
        } else {
          // Save current group and start new one
          const phraseText =
            wordIndexToText.get(currentGroup[0]) ||
            currentGroup.map((i) => allWords[i] || "").join(" ");
          wordGroups.push({ indices: [...currentGroup], text: phraseText });
          currentGroup = [idx];
        }
      }
    }

    // Add the last group
    if (currentGroup.length > 0) {
      const phraseText =
        wordIndexToText.get(currentGroup[0]) ||
        currentGroup.map((i) => allWords[i] || "").join(" ");
      wordGroups.push({ indices: [...currentGroup], text: phraseText });
    }

    // Count flashcards: each group (phrase or word) counts as 1
    return wordGroups.length;
  };

  const handlePhraseSelect = (phrase: string, indices: number[]) => {
    // Store phrase text and all its indices
    // Store the full phrase on ALL indices so we can detect them later
    setWordIndexToText((prev) => {
      const newMap = new Map(prev);
      // Store the full phrase on ALL indices in the phrase
      indices.forEach((idx) => {
        newMap.set(idx, phrase);
      });
      return newMap;
    });

    // Remove individual word selections that are part of this phrase
    setSelectedWordIndices((prev) => {
      const newSet = new Set(prev);
      indices.forEach((idx) => {
        newSet.delete(idx);
      });
      // Add all indices from the phrase
      indices.forEach((idx) => newSet.add(idx));
      return newSet;
    });
  };

  const handleCreateFlashcardsFromSelectedWords = async () => {
    if (selectedWordIndices.size === 0) {
      onError?.("Please select at least one word");
      return;
    }

    setTranslatingSelectedWords(true);
    onError?.("");

    try {
      // Extract all words from text to map indices to words
      const allWords: string[] = [];
      const regex = /(\S+)/g;
      let match;
      while ((match = regex.exec(extractedText)) !== null) {
        allWords.push(match[0]);
      }

      // Group consecutive selected indices into phrases
      // Priority: Created phrases (stored in wordIndexToText with spaces) take precedence
      const sortedIndices = Array.from(selectedWordIndices).sort(
        (a, b) => a - b
      );
      const wordGroups: Array<{ indices: number[]; text: string }> = [];
      const processedIndices = new Set<number>();

      // First pass: Process created phrases (phrases stored in wordIndexToText)
      // Group indices that have the same phrase text (they're all part of the same phrase)
      const phraseMap = new Map<string, number[]>();

      for (const idx of sortedIndices) {
        if (processedIndices.has(idx)) continue;

        const storedText = wordIndexToText.get(idx);
        if (storedText && storedText.includes(" ")) {
          // This is a phrase - collect all indices that have this same phrase text
          if (!phraseMap.has(storedText)) {
            phraseMap.set(storedText, []);
          }
          phraseMap.get(storedText)!.push(idx);
        }
      }

      // Process each unique phrase
      for (const [phraseText, phraseIndices] of phraseMap.entries()) {
        // Sort the indices to get them in order
        const sortedPhraseIndices = phraseIndices.sort((a, b) => a - b);

        // Only process if we haven't already processed any of these indices
        if (sortedPhraseIndices.some((idx) => processedIndices.has(idx))) {
          continue;
        }

        // Create a group for this phrase with all its indices
        wordGroups.push({
          indices: [...sortedPhraseIndices],
          text: phraseText,
        });

        // Mark all indices in this phrase as processed
        sortedPhraseIndices.forEach((i) => processedIndices.add(i));
      }

      // Second pass: Process remaining individual words (not part of phrases)
      let currentGroup: number[] = [];
      for (const idx of sortedIndices) {
        if (processedIndices.has(idx)) continue;

        if (currentGroup.length === 0) {
          currentGroup = [idx];
        } else {
          const lastIdx = currentGroup[currentGroup.length - 1];
          // Check if indices are consecutive (next word in the array)
          if (idx === lastIdx + 1) {
            currentGroup.push(idx);
          } else {
            // Save current group and start new one
            const phraseText =
              wordIndexToText.get(currentGroup[0]) ||
              currentGroup.map((i) => allWords[i] || "").join(" ");
            wordGroups.push({ indices: [...currentGroup], text: phraseText });
            currentGroup = [idx];
          }
        }
      }

      // Add the last group
      if (currentGroup.length > 0) {
        const phraseText =
          wordIndexToText.get(currentGroup[0]) ||
          currentGroup.map((i) => allWords[i] || "").join(" ");
        wordGroups.push({ indices: [...currentGroup], text: phraseText });
      }

      const newWordPairs: WordPair[] = [];

      for (const group of wordGroups) {
        const word = group.text;
        // Check if it's a phrase (contains spaces) or a single word
        const isPhrase = group.indices.length > 1 || word.trim().includes(" ");
        // For phrases, just trim. For single words, remove leading/trailing punctuation
        const cleanWord = isPhrase
          ? word.trim()
          : word.trim().replace(/^[^\w]+|[^\w]+$/g, "");
        if (!cleanWord) continue;

        if (aiHelpEnabled) {
          // AI Help is enabled - translate the word/phrase
          try {
            const response = await fetch("/api/translate-word", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                word: cleanWord,
                fromLanguage,
                toLanguage,
                // For phrases, always use phrase translation mode
                translateToOneWord: isPhrase ? false : translateToOneWord,
                translateToPhrase: isPhrase ? true : translateToPhrase,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              newWordPairs.push({
                word: isPhrase ? word.trim() : cleanWord,
                translation: data.translation || "",
              });
            } else {
              newWordPairs.push({
                word: isPhrase ? word.trim() : cleanWord,
                translation: "",
              });
            }
          } catch {
            newWordPairs.push({
              word: isPhrase ? word.trim() : cleanWord,
              translation: "",
            });
          }
        } else {
          // AI Help is disabled - just add words/phrases without translation
          newWordPairs.push({
            word: isPhrase ? word.trim() : cleanWord,
            translation: "",
          });
        }
      }

      onWordsCreated(newWordPairs);

      // Mark used word indices as used
      const usedIndices = new Set<number>();
      wordGroups.forEach((group) => {
        group.indices.forEach((idx) => usedIndices.add(idx));
      });

      setUsedWordIndices((prev) => {
        const newUsed = new Set(prev);
        usedIndices.forEach((idx) => newUsed.add(idx));
        return newUsed;
      });

      // Clear current selection so user can select more
      setSelectedWordIndices(new Set());

      if (onCoinsUpdate) {
        onCoinsUpdate();
      }
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Failed to create flashcards"
      );
    } finally {
      setTranslatingSelectedWords(false);
    }
  };

  const handleToggle = () => {
    setImageUploadMode(!imageUploadMode);
    if (imageUploadMode) {
      setUploadedImage(null);
      setExtractedText("");
      setSelectedWordIndices(new Set());
      setUsedWordIndices(new Set());
      setWordIndexToText(new Map());
      setNoTextAlert(false);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setExtractedText("");
    setSelectedWordIndices(new Set());
    setUsedWordIndices(new Set());
    setWordIndexToText(new Map());
    setNoTextAlert(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
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
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Upload Image & Extract Text
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            imageUploadMode
              ? "bg-blue-600 dark:bg-blue-500"
              : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              imageUploadMode ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {imageUploadMode && (
        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
          {processingImage ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative">
                <svg
                  className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-400"
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
              <p className="mt-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Processing image...
              </p>
            </div>
          ) : !uploadedImage ? (
            <div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-8 h-8 mb-2 text-gray-400"
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
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PNG, JPG, or HEIC up to 10MB
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUploadForOCR(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Image Preview */}
              <div className="relative w-full max-w-md mx-auto">
                <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
                  <Image
                    src={uploadedImage}
                    alt="Uploaded image"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
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

              {/* No Text Alert */}
              {noTextAlert && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                      No Text Found
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      There is no text in the picture. Please upload an image
                      that contains readable text.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoTextAlert(false)}
                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {/* Extract Text Button */}
              {!extractedText && (
                <button
                  type="button"
                  onClick={extractTextFromImage}
                  disabled={extractingText}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {extractingText ? (
                    <>
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
                      Extracting text...
                    </>
                  ) : (
                    <>
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
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Extract Text from Image
                    </>
                  )}
                </button>
              )}

              {/* Extracted Text with Word Selection */}
              {extractedText && (
                <div className="space-y-3">
                  <ImageTextSelector
                    text={extractedText}
                    selectedWordIndices={selectedWordIndices}
                    usedWordIndices={usedWordIndices}
                    onWordToggle={toggleWordSelection}
                    onPhraseSelect={handlePhraseSelect}
                  />

                  {/* Done Button - Show when there are selected words */}
                  {selectedWordIndices.size > 0 &&
                    (() => {
                      const flashcardCount = calculateFlashcardCount();
                      return (
                        <button
                          type="button"
                          onClick={handleCreateFlashcardsFromSelectedWords}
                          disabled={
                            translatingSelectedWords ||
                            selectedWordIndices.size === 0
                          }
                          className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
                        >
                          {translatingSelectedWords ? (
                            <>
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
                              Translating {flashcardCount} flashcard
                              {flashcardCount !== 1 ? "s" : ""}...
                            </>
                          ) : (
                            <>
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
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Done - Create {flashcardCount} Flashcard
                              {flashcardCount !== 1 ? "s" : ""}
                            </>
                          )}
                        </button>
                      );
                    })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
