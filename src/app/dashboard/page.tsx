"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Flashcard from "@/components/Flashcard";
import InlineCreateFlashcardSetForm from "@/components/InlineCreateFlashcardSetForm";
import InlineAIGenerateForm from "@/components/InlineAIGenerateForm";
import { getLanguageFlag } from "@/lib/flags";

interface User {
  id: number;
  email: string;
  nickname: string;
  createdAt: string;
}

interface WordImage {
  id: number;
  dataUrl: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

interface WordAudio {
  id: number;
  dataUrl: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

interface Word {
  id: number;
  word: string;
  translation: string;
  difficulty: number;
  userId: number;
  flashcardSetId: number | null;
  pronunciation: string | null;
  imageId: number | null;
  audioId: number | null;
  image: WordImage | null;
  audio: WordAudio | null;
  createdAt: string;
  updatedAt: string;
}

interface FlashcardSet {
  id: number;
  name: string;
  userId: number;
  fromLanguage: string | null;
  toLanguage: string | null;
  isAIGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  words: Word[];
}

type ViewMode = "sets" | "cards";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<FlashcardSet | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAIGenerateForm, setShowAIGenerateForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("sets");
  const router = useRouter();

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    setShowAIGenerateForm(false);
    fetchFlashcardSets();
  };

  useEffect(() => {
    // Check if user data exists in localStorage (from login)
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      // If no user data, redirect to home page
      router.push("/");
      return;
    }
    fetchFlashcardSets();
  }, [router]);

  const fetchFlashcardSets = async () => {
    try {
      const response = await fetch("/api/flashcard-sets");
      if (response.ok) {
        const data = await response.json();
        setFlashcardSets(data.flashcardSets || []);
      }
    } catch (error) {
      console.error("Error fetching flashcard sets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleSetClick = (set: FlashcardSet) => {
    setSelectedSet(set);
    setCurrentIndex(0);
    setViewMode("cards");
  };

  const handleBackToSets = () => {
    setSelectedSet(null);
    setViewMode("sets");
    setCurrentIndex(0);
  };

  const handleNext = () => {
    if (selectedSet && currentIndex < selectedSet.words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const totalWords = flashcardSets.reduce(
    (sum, set) => sum + set.words.length,
    0
  );
  const currentWord = selectedSet?.words[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            DuoCards
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Welcome back, {user.nickname}!
          </p>
        </div>

        {/* Stats Section */}
        <div className="p-6 space-y-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Flashcard Sets
            </span>
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              {flashcardSets.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Words
            </span>
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              {totalWords}
            </span>
          </div>
          {viewMode === "cards" && selectedSet && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Card
              </span>
              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedSet.words.length > 0
                  ? `${currentIndex + 1} / ${selectedSet.words.length}`
                  : "0 / 0"}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 p-6">
          <nav className="space-y-2">
            <button
              onClick={() => {
                setViewMode("sets");
                handleBackToSets();
              }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer active:scale-[0.98] ${
                viewMode === "sets"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Flashcard Sets
              </div>
            </button>
            <button className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer active:scale-[0.98]">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Statistics
              </div>
            </button>
          </nav>
        </div>

        {/* Logout Button */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center cursor-pointer active:scale-[0.98]"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {viewMode === "sets" ? (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Your Flashcard Sets
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Click on a set to start practicing
              </p>
            </div>

            {/* Create New Set Forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {showCreateForm ? (
                <div className="col-span-1 md:col-span-2">
                  <InlineCreateFlashcardSetForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setShowCreateForm(false)}
                  />
                </div>
              ) : showAIGenerateForm ? (
                <div className="col-span-1 md:col-span-2">
                  <InlineAIGenerateForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setShowAIGenerateForm(false)}
                  />
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowCreateForm(true);
                      setShowAIGenerateForm(false);
                    }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all p-4 text-left border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 flex flex-col items-center justify-center min-h-[140px] cursor-pointer active:scale-[0.98]"
                  >
                    <svg
                      className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2"
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
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      Create New Set
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Manually add words and translations
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      setShowAIGenerateForm(true);
                      setShowCreateForm(false);
                    }}
                    className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl shadow-lg hover:shadow-xl transition-all p-4 text-left border-2 border-dashed border-purple-300 dark:border-purple-600 hover:border-purple-500 dark:hover:border-purple-400 flex flex-col items-center justify-center min-h-[140px] cursor-pointer active:scale-[0.98]"
                  >
                    <svg
                      className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2"
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
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      AI Generate
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Let AI create flashcards for you
                    </p>
                  </button>
                </>
              )}
            </div>

            {flashcardSets.length === 0 &&
            !showCreateForm &&
            !showAIGenerateForm ? (
              <div className="text-center py-16">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No flashcard sets yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create your first flashcard set to get started!
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
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
                  Make New Flashcard Set
                </button>
              </div>
            ) : (
              <>
                {flashcardSets.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flashcardSets.map((set) => (
                      <button
                        key={set.id}
                        onClick={() => handleSetClick(set)}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all p-6 text-left border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {set.name}
                          </h3>
                          <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap">
                            {set.words.length}{" "}
                            {set.words.length === 1 ? "card" : "cards"}
                          </div>
                        </div>
                        {/* Language Flags */}
                        <div className="flex items-center justify-between mb-2">
                          {(set.fromLanguage || set.toLanguage) && (
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">
                                {getLanguageFlag(set.fromLanguage)}
                              </span>
                              <svg
                                className="w-4 h-4 text-gray-400 dark:text-gray-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                                />
                              </svg>
                              <span className="text-2xl">
                                {getLanguageFlag(set.toLanguage)}
                              </span>
                            </div>
                          )}
                          {set.isAIGenerated && (
                            <div className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 text-purple-700 dark:text-purple-400 px-3 py-1 rounded-full text-xs font-semibold">
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
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                              </svg>
                              AI Generated
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Created {new Date(set.createdAt).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Back button and set name */}
            <div className="mb-6">
              <button
                onClick={handleBackToSets}
                className="mb-4 flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer active:scale-[0.98]"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Flashcard Sets
              </button>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {selectedSet?.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedSet?.words.length || 0} cards in this set
              </p>
            </div>

            {/* Flashcard display */}
            <div className="flex-1 flex items-center justify-center">
              {selectedSet && currentWord ? (
                <Flashcard
                  word={currentWord.word}
                  translation={currentWord.translation}
                  difficulty={currentWord.difficulty}
                  pronunciation={currentWord.pronunciation}
                  imageUrl={currentWord.image?.dataUrl || null}
                  audioUrl={currentWord.audio?.dataUrl || null}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                  hasNext={currentIndex < selectedSet.words.length - 1}
                  hasPrevious={currentIndex > 0}
                />
              ) : (
                <div className="text-center">
                  <svg
                    className="w-16 h-16 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    No cards in this set
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This flashcard set is empty
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
