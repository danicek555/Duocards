"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Flashcard from "@/components/Flashcard";
import InlineCreateFlashcardSetForm from "@/components/InlineCreateFlashcardSetForm";
import InlineAIGenerateForm from "@/components/InlineAIGenerateForm";
import CoinCostsModal from "@/components/CoinCostsModal";
import DailyRewardButton from "@/components/DailyRewardButton";
import CreateFlashcardSetForm from "@/components/CreateFlashcardSetForm";
import { getLanguageFlag } from "@/lib/flags";
import { LANGUAGES } from "@/lib/languages";

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
  tags: string[];
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
  const [coins, setCoins] = useState<number | null>(null);
  const [showCostsModal, setShowCostsModal] = useState(false);
  // Cache for fetched images and audio
  const [imageCache, setImageCache] = useState<Record<number, string>>({});
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});
  const [openSettingsId, setOpenSettingsId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [settingsMenuPosition, setSettingsMenuPosition] = useState<
    Record<number, "left" | "right">
  >({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editingSetData, setEditingSetData] = useState<FlashcardSet | null>(
    null
  );
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);
  const [filtering, setFiltering] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterFromLanguage, setFilterFromLanguage] = useState<string>("");
  const [filterToLanguage, setFilterToLanguage] = useState<string>("");
  const router = useRouter();

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    setShowAIGenerateForm(false);
    fetchFlashcardSets();
    fetchCoins(); // Refresh coins after AI generation
  };

  const fetchCoins = async () => {
    try {
      const response = await fetch("/api/user/coins");
      if (response.ok) {
        const data = await response.json();
        setCoins(data.coins);
      }
    } catch (error) {
      console.error("Error fetching coins:", error);
    }
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
    fetchCoins();
  }, [router]);

  // Helper function to calculate menu position
  const calculateMenuPosition = (
    setId: number,
    buttonElement: HTMLElement
  ): "left" | "right" => {
    const rect = buttonElement.getBoundingClientRect();
    const menuWidth = 150; // Approximate menu width
    const spaceOnRight = window.innerWidth - rect.right;
    const spaceOnLeft = rect.left;

    // If there's not enough space on the right but more space on the left, show on left
    if (spaceOnRight < menuWidth && spaceOnLeft > spaceOnRight) {
      return "left";
    }
    return "right";
  };

  // Recalculate position on window resize when menu is open
  useEffect(() => {
    const handleResize = () => {
      if (openSettingsId !== null) {
        const container = document.querySelector(
          `.settings-menu-container[data-set-id="${openSettingsId}"]`
        ) as HTMLElement;

        if (container) {
          const position = calculateMenuPosition(openSettingsId, container);
          setSettingsMenuPosition((prev) => ({
            ...prev,
            [openSettingsId]: position,
          }));
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [openSettingsId]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        openSettingsId !== null &&
        !target.closest(".settings-menu-container")
      ) {
        setOpenSettingsId(null);
        setDeleteConfirmId(null);
      }
    };

    if (openSettingsId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [openSettingsId]);

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

  const handleSetClick = async (set: FlashcardSet) => {
    // Fetch full flashcard set data including images/audio when viewing
    try {
      const response = await fetch(`/api/flashcard-sets/${set.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedSet(data.flashcardSet);
        setCurrentIndex(0);
        setViewMode("cards");
      } else {
        // Fallback to the set data we already have (without images/audio)
        setSelectedSet(set);
        setCurrentIndex(0);
        setViewMode("cards");
      }
    } catch (error) {
      console.error("Error fetching flashcard set details:", error);
      // Fallback to the set data we already have (without images/audio)
      setSelectedSet(set);
      setCurrentIndex(0);
      setViewMode("cards");
    }
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

  const handleDeleteSet = async (setId: number) => {
    setDeletingId(setId);
    try {
      const response = await fetch(`/api/flashcard-sets/${setId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Remove from local state
        setFlashcardSets((prev) => prev.filter((set) => set.id !== setId));
        // If the deleted set was selected, go back to sets view
        if (selectedSet?.id === setId) {
          handleBackToSets();
        }
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete flashcard set");
      }
    } catch (error) {
      console.error("Error deleting flashcard set:", error);
      alert("Failed to delete flashcard set");
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
      setOpenSettingsId(null);
    }
  };

  const handleEditSet = async (setId: number) => {
    setLoadingEditId(setId);
    try {
      const response = await fetch(`/api/flashcard-sets/${setId}`);
      if (response.ok) {
        const data = await response.json();
        setEditingSetData(data.flashcardSet);
        setEditingSetId(setId);
        setOpenSettingsId(null);
      } else {
        alert("Failed to load flashcard set for editing");
      }
    } catch (error) {
      console.error("Error loading flashcard set:", error);
      alert("Failed to load flashcard set for editing");
    } finally {
      setLoadingEditId(null);
    }
  };

  const handleEditSuccess = () => {
    setEditingSetId(null);
    setEditingSetData(null);
    fetchFlashcardSets();
    // If editing the currently selected set, refresh it
    if (selectedSet && editingSetId === selectedSet.id) {
      handleSetClick(selectedSet);
    }
  };

  const totalWords = flashcardSets.reduce(
    (sum, set) => sum + set.words.length,
    0
  );
  const currentWord = selectedSet?.words[currentIndex];

  // Fetch image/audio for current word if not already cached
  useEffect(() => {
    if (!currentWord) return;

    const fetchImage = async () => {
      if (currentWord.imageId && !imageCache[currentWord.imageId]) {
        try {
          const response = await fetch(
            `/api/word-images/${currentWord.imageId}`
          );
          if (response.ok) {
            const data = await response.json();
            setImageCache((prev) => ({
              ...prev,
              [currentWord.imageId!]: data.image.dataUrl,
            }));
          }
        } catch (error) {
          console.error("Error fetching image:", error);
        }
      }
    };

    const fetchAudio = async () => {
      if (currentWord.audioId && !audioCache[currentWord.audioId]) {
        try {
          const response = await fetch(
            `/api/word-audio/${currentWord.audioId}`
          );
          if (response.ok) {
            const data = await response.json();
            setAudioCache((prev) => ({
              ...prev,
              [currentWord.audioId!]: data.audio.dataUrl,
            }));
          }
        } catch (error) {
          console.error("Error fetching audio:", error);
        }
      }
    };

    fetchImage();
    fetchAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.id, currentWord?.imageId, currentWord?.audioId]);

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
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Coins
            </span>
            <span className="text-xl font-semibold text-purple-600 dark:text-purple-400">
              {coins !== null ? coins : "..."}
            </span>
          </div>
          <button
            onClick={() => setShowCostsModal(true)}
            className="w-full mt-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors text-left"
          >
            See more →
          </button>

          {/* Daily Reward Button */}
          <div className="mt-4">
            <DailyRewardButton onCoinsUpdate={fetchCoins} />
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
              <p className="text-gray-600 dark:text-gray-400 mb-1">
                Click on a set to start practicing
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                {flashcardSets.length} / 100 flashcard sets
              </p>
            </div>

            {/* Create New Set Forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {showCreateForm ? (
                <div className="col-span-1 md:col-span-2">
                  <InlineCreateFlashcardSetForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setShowCreateForm(false)}
                    onCoinsUpdate={fetchCoins}
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
                      if (flashcardSets.length >= 100) {
                        alert("Maximum 100 flashcard sets allowed");
                        return;
                      }
                      setShowCreateForm(true);
                      setShowAIGenerateForm(false);
                    }}
                    disabled={flashcardSets.length >= 100}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all p-4 text-left border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 flex flex-col items-center justify-center min-h-[140px] cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600"
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
                      if (flashcardSets.length >= 100) {
                        alert("Maximum 100 flashcard sets allowed");
                        return;
                      }
                      setShowAIGenerateForm(true);
                      setShowCreateForm(false);
                    }}
                    disabled={flashcardSets.length >= 100}
                    className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl shadow-lg hover:shadow-xl transition-all p-4 text-left border-2 border-dashed border-purple-300 dark:border-purple-600 hover:border-purple-500 dark:hover:border-purple-400 flex flex-col items-center justify-center min-h-[140px] cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-purple-300 dark:disabled:hover:border-purple-600"
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

            {/* Filters */}
            {flashcardSets.length > 0 && (
              <div className="mb-6 space-y-3">
                {/* Language Filters */}
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      From:
                    </label>
                    <select
                      value={filterFromLanguage}
                      onChange={(e) => {
                        setFiltering(true);
                        setFilterFromLanguage(e.target.value);
                        setTimeout(() => setFiltering(false), 300);
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="">All languages</option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      To:
                    </label>
                    <select
                      value={filterToLanguage}
                      onChange={(e) => {
                        setFiltering(true);
                        setFilterToLanguage(e.target.value);
                        setTimeout(() => setFiltering(false), 300);
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="">All languages</option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(filterFromLanguage ||
                    filterToLanguage ||
                    selectedTags.length > 0) && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setFiltering(true);
                          setFilterFromLanguage("");
                          setFilterToLanguage("");
                          setSelectedTags([]);
                          setTimeout(() => setFiltering(false), 300);
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Clear filters
                      </button>
                      {filtering && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <svg
                            className="animate-spin h-3 w-3"
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
                          Filtering...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Custom Tags Filter */}
                {(() => {
                  // Get all unique custom tags (excluding language tags)
                  const allTags = new Set<string>();
                  flashcardSets.forEach((set) => {
                    if (set.isAIGenerated) allTags.add("AI Generated");
                    set.tags?.forEach((tag) => allTags.add(tag));
                  });
                  const tagsArray = Array.from(allTags).sort();
                  if (tagsArray.length === 0) return null;

                  return (
                    <div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Filter by tags:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tagsArray.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => {
                              setFiltering(true);
                              setSelectedTags((prev) =>
                                prev.includes(tag)
                                  ? prev.filter((t) => t !== tag)
                                  : [...prev, tag]
                              );
                              setTimeout(() => setFiltering(false), 300);
                            }}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                              selectedTags.includes(tag)
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

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
                  onClick={() => {
                    if (flashcardSets.length >= 100) {
                      alert("Maximum 100 flashcard sets allowed");
                      return;
                    }
                    setShowCreateForm(true);
                  }}
                  disabled={flashcardSets.length >= 100}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                {(() => {
                  // Filter flashcard sets based on language filters and tags
                  let filteredSets = flashcardSets;

                  // Apply language filters
                  if (filterFromLanguage || filterToLanguage) {
                    filteredSets = filteredSets.filter((set) => {
                      const fromMatch =
                        !filterFromLanguage ||
                        set.fromLanguage === filterFromLanguage;
                      const toMatch =
                        !filterToLanguage ||
                        set.toLanguage === filterToLanguage;
                      return fromMatch && toMatch;
                    });
                  }

                  // Apply custom tags filter
                  if (selectedTags.length > 0) {
                    filteredSets = filteredSets.filter((set) => {
                      const setTags = new Set<string>();
                      if (set.isAIGenerated) setTags.add("AI Generated");
                      set.tags?.forEach((tag) => setTags.add(tag));

                      // Check if any selected tag matches
                      return selectedTags.some((tag) => setTags.has(tag));
                    });
                  }

                  return filteredSets;
                })().length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(() => {
                      // Filter flashcard sets based on language filters and tags
                      let filteredSets = flashcardSets;

                      // Apply language filters
                      if (filterFromLanguage || filterToLanguage) {
                        filteredSets = filteredSets.filter((set) => {
                          const fromMatch =
                            !filterFromLanguage ||
                            set.fromLanguage === filterFromLanguage;
                          const toMatch =
                            !filterToLanguage ||
                            set.toLanguage === filterToLanguage;
                          return fromMatch && toMatch;
                        });
                      }

                      // Apply custom tags filter
                      if (selectedTags.length > 0) {
                        filteredSets = filteredSets.filter((set) => {
                          const setTags = new Set<string>();
                          if (set.isAIGenerated) setTags.add("AI Generated");
                          set.tags?.forEach((tag) => setTags.add(tag));

                          // Check if any selected tag matches
                          return selectedTags.some((tag) => setTags.has(tag));
                        });
                      }

                      return filteredSets;
                    })().map((set) => (
                      <div
                        key={set.id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all p-6 text-left border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 relative"
                      >
                        <button
                          onClick={() => handleSetClick(set)}
                          className="w-full text-left"
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
                          {/* Tags */}
                          {(() => {
                            const displayTags: string[] = [];
                            // Always include AI Generated tag if set is AI-generated
                            if (
                              set.isAIGenerated &&
                              !set.tags?.includes("AI Generated")
                            ) {
                              displayTags.push("AI Generated");
                            }
                            // Add other tags
                            if (set.tags && set.tags.length > 0) {
                              displayTags.push(...set.tags);
                            }
                            return displayTags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {displayTags.slice(0, 5).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null;
                          })()}
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
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Created{" "}
                            {new Date(set.createdAt).toLocaleDateString()}
                          </p>
                        </button>
                        {/* Settings button in bottom right corner */}
                        <div
                          className="absolute bottom-4 right-4 settings-menu-container"
                          data-set-id={set.id}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const button = e.currentTarget;

                              if (openSettingsId === set.id) {
                                // Close menu
                                setOpenSettingsId(null);
                                setDeleteConfirmId(null);
                              } else {
                                // Calculate position synchronously before opening menu
                                const position = calculateMenuPosition(
                                  set.id,
                                  button
                                );

                                // Set position first
                                setSettingsMenuPosition((prev) => ({
                                  ...prev,
                                  [set.id]: position,
                                }));

                                // Use setTimeout to ensure position state is set before menu renders
                                setTimeout(() => {
                                  setOpenSettingsId(set.id);
                                  setDeleteConfirmId(null);
                                }, 0);
                              }
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors z-10"
                            title="Settings"
                          >
                            <svg
                              className="w-4 h-4 text-gray-600 dark:text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                              />
                            </svg>
                          </button>
                          {/* Settings menu */}
                          {openSettingsId === set.id &&
                            settingsMenuPosition[set.id] && (
                              <div
                                className={`absolute top-[-90px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[120px] z-20 ${
                                  settingsMenuPosition[set.id] === "left"
                                    ? "right-full mr-[-10px]"
                                    : "left-full ml-[-10px]"
                                }`}
                              >
                                {deleteConfirmId === set.id ? (
                                  <div className="px-3 py-2">
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                      Delete this set?
                                    </p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSet(set.id);
                                        }}
                                        disabled={deletingId === set.id}
                                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                      >
                                        {deletingId === set.id ? (
                                          <>
                                            <svg
                                              className="animate-spin h-3 w-3"
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
                                            Deleting...
                                          </>
                                        ) : (
                                          "Yes"
                                        )}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirmId(null);
                                          setOpenSettingsId(null);
                                        }}
                                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditSet(set.id);
                                      }}
                                      disabled={loadingEditId === set.id}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {loadingEditId === set.id ? (
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
                                          Loading...
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
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                          </svg>
                                          Change
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(set.id);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
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
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-gray-600 dark:text-gray-400">
                      No flashcard sets match the selected filters.
                    </p>
                    {(filterFromLanguage ||
                      filterToLanguage ||
                      selectedTags.length > 0) && (
                      <button
                        onClick={() => {
                          setFiltering(true);
                          setFilterFromLanguage("");
                          setFilterToLanguage("");
                          setSelectedTags([]);
                          setTimeout(() => setFiltering(false), 300);
                        }}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                      >
                        {filtering && (
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
                        )}
                        Clear filters
                      </button>
                    )}
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
                  imageUrl={
                    currentWord.imageId
                      ? imageCache[currentWord.imageId] || null
                      : null
                  }
                  audioUrl={
                    currentWord.audioId
                      ? audioCache[currentWord.audioId] || null
                      : null
                  }
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

      {/* Coin Costs Modal */}
      <CoinCostsModal
        isOpen={showCostsModal}
        onClose={() => setShowCostsModal(false)}
      />

      {/* Edit Flashcard Set Form */}
      {editingSetId && editingSetData && (
        <CreateFlashcardSetForm
          onClose={() => {
            setEditingSetId(null);
            setEditingSetData(null);
          }}
          onSuccess={handleEditSuccess}
          onCoinsUpdate={fetchCoins}
          editSetId={editingSetId}
          initialData={{
            name: editingSetData.name,
            fromLanguage: editingSetData.fromLanguage,
            toLanguage: editingSetData.toLanguage,
            tags: editingSetData.tags || [],
            words: editingSetData.words.map((word) => ({
              word: word.word,
              translation: word.translation,
              pronunciation: word.pronunciation,
              imageId: word.imageId,
              audioId: word.audioId,
            })),
          }}
        />
      )}
    </div>
  );
}
