"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Flashcard from "@/components/Flashcard";
import InlineCreateFlashcardSetForm from "@/components/InlineCreateFlashcardSetForm";
import InlineAIGenerateForm from "@/components/InlineAIGenerateForm";
import CoinCostsModal from "@/components/CoinCostsModal";
import DailyRewardButton from "@/components/DailyRewardButton";
import CreateFlashcardSetForm from "@/components/CreateFlashcardSetForm";
import JoinPublicSetModal from "@/components/JoinPublicSetModal";
import MoneyBagReward from "@/components/MoneyBagReward";
import PublicLibraryPanel from "@/components/PublicLibraryPanel";
import LiveGameHistoryPanel from "@/components/LiveGameHistoryPanel";
import Notification from "@/components/Notification";
import SettingsModal from "@/components/SettingsModal";
import { useI18n } from "@/i18n/I18nProvider";
import { isLocale } from "@/i18n/types";
import { getLanguageFlag } from "@/lib/flags";
import { getLanguageLabel, LANGUAGES } from "@/lib/languages";
import { getGuestLiveGameBaseUrl } from "@/lib/publicUrls";
import { apiFetch } from "@/lib/apiUrl";

interface User {
  id: number;
  email: string;
  nickname: string;
  locale?: string;
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
  isPublic?: boolean;
  publicCode?: string | null;
  joinedFromCode?: string | null; // Original public code used to join (for shared sets)
  createdAt: string;
  updatedAt: string;
  words: Word[];
}

type ViewMode = "sets" | "cards" | "library" | "liveHistory";
const AI_GENERATED_TAG = "AI Generated";

export default function Dashboard() {
  const { t, locale, setLocale } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<FlashcardSet | null>(null);
  const [studyQueue, setStudyQueue] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAIGenerateForm, setShowAIGenerateForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("sets");

  // Deep-link support: /dashboard?view=library or ?view=live-history opens
  // the corresponding panel (used by the /library and /live-game/history
  // redirect routes).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "library") setViewMode("library");
    else if (view === "live-history") setViewMode("liveHistory");
    if (view) window.history.replaceState({}, "", "/dashboard");
  }, []);
  const [coins, setCoins] = useState<number | null>(null);
  const [showCostsModal, setShowCostsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // Cache for fetched images and audio
  const [imageCache, setImageCache] = useState<Record<number, string>>({});
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});
  const imageCacheRef = useRef(imageCache);
  const audioCacheRef = useRef(audioCache);
  imageCacheRef.current = imageCache;
  audioCacheRef.current = audioCache;
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaLoadProgress, setMediaLoadProgress] = useState({
    loaded: 0,
    total: 0,
    imageTotal: 0,
    audioTotal: 0,
  });
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
  const [showAllTags, setShowAllTags] = useState(false);
  const [filterFromLanguage, setFilterFromLanguage] = useState<string>("");
  const [filterToLanguage, setFilterToLanguage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  // Store claimed rewards as Set of flashcard set IDs (claimed today from database)
  const [claimedRewards, setClaimedRewards] = useState<Set<number>>(new Set());
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "warning" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });
  const router = useRouter();

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    setShowAIGenerateForm(false);
    fetchFlashcardSets();
    fetchCoins(); // Refresh coins after AI generation
  };

  const fetchCoins = async () => {
    try {
      const response = await apiFetch("/user/coins");
      if (response.ok) {
        const data = await response.json();
        setCoins(data.coins);
      }
    } catch (error) {
      console.error("Error fetching coins:", error);
    }
  };

  const fetchClaimedRewards = async () => {
    try {
      const response = await fetch("/api/flashcard-sets/claimed-rewards");
      if (response.ok) {
        const data = await response.json();
        setClaimedRewards(new Set(data.claimedSetIds || []));
      } else {
        console.error("Error fetching claimed rewards");
        setClaimedRewards(new Set());
      }
    } catch (error) {
      console.error("Error fetching claimed rewards:", error);
      setClaimedRewards(new Set());
    }
  };

  useEffect(() => {
    // Dispatch loading event for AI button
    window.dispatchEvent(
      new CustomEvent("dashboardLoading", { detail: { loading: true } })
    );

    const applyUserLocale = (nextUser: User) => {
      if (isLocale(nextUser.locale)) {
        setLocale(nextUser.locale, { persist: true, sync: false });
      }
    };

    const loadSession = async () => {
      try {
        // localStorage is only a display cache. Always ask the backend so a
        // password reset revokes this device on its next dashboard load.
        const response = await apiFetch("/auth/me");
        if (!response.ok) {
          throw new Error("Unauthorized");
        }
        const data = await response.json();
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
        applyUserLocale(data.user);
        fetchFlashcardSets();
        fetchCoins();
        fetchClaimedRewards();
      } catch {
        localStorage.removeItem("user");
        try {
          await apiFetch("/auth/logout", { method: "POST" });
        } catch {
          // The backend may be unavailable; local state is still cleared.
        }
        window.dispatchEvent(
          new CustomEvent("dashboardLoading", { detail: { loading: false } })
        );
        router.replace("/");
      }
    };

    loadSession();
  }, [router]);

  // Listen for coin updates from AI chat
  useEffect(() => {
    const handleCoinsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ coins: number }>;
      if (customEvent.detail?.coins !== undefined) {
        setCoins(customEvent.detail.coins);
      }
    };

    window.addEventListener("coinsUpdated", handleCoinsUpdated);

    return () => {
      window.removeEventListener("coinsUpdated", handleCoinsUpdated);
    };
  }, []);

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
      const response = await apiFetch("/flashcard-sets");
      if (response.ok) {
        const data = await response.json();
        setFlashcardSets(data.flashcardSets || []);
      }
    } catch (error) {
      console.error("Error fetching flashcard sets:", error);
    } finally {
      setLoading(false);
      // Dispatch loaded event for AI button
      window.dispatchEvent(
        new CustomEvent("dashboardLoading", { detail: { loading: false } })
      );
    }
  };

  const handleLogout = async () => {
    try {
      // Call logout API to clear auth cookie
      await apiFetch("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear localStorage
      localStorage.removeItem("user");
      localStorage.removeItem("rememberMe");
      localStorage.removeItem("rememberedEmail");

      // Redirect to home
      router.push("/");
    }
  };

  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleSetClick = async (set: FlashcardSet) => {
    // Open cards immediately; images/audio load in the background via prefetch
    const shuffledSet = {
      ...set,
      words: shuffleArray(set.words),
    };
    setSelectedSet(shuffledSet);
    setStudyQueue(shuffledSet.words.map((word) => word.id));
    setViewMode("cards");

    try {
      const response = await apiFetch(`/flashcard-sets/${set.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedSet((prev) => {
          if (!prev || prev.id !== set.id) {
            return {
              ...data.flashcardSet,
              words: shuffleArray(data.flashcardSet.words),
            };
          }
          const wordById = new Map(
            data.flashcardSet.words.map((w: Word) => [w.id, w])
          );
          return {
            ...data.flashcardSet,
            words: prev.words.map((w) => wordById.get(w.id) ?? w),
          };
        });
      }
    } catch (error) {
      console.error("Error fetching flashcard set details:", error);
    }
  };

  const handleBackToSets = () => {
    setSelectedSet(null);
    setStudyQueue([]);
    setViewMode("sets");
  };

  const handleDontKnow = () => {
    setStudyQueue((queue) =>
      queue.length > 1 ? [...queue.slice(1), queue[0]] : queue
    );
  };

  const handleKnow = () => {
    setStudyQueue((queue) => queue.slice(1));
  };

  const handleRestartStudy = () => {
    if (!selectedSet) return;

    const shuffledWords = shuffleArray(selectedSet.words);
    setSelectedSet({ ...selectedSet, words: shuffledWords });
    setStudyQueue(shuffledWords.map((word) => word.id));
  };

  // Calculate reward amount based on flashcard count
  const getRewardAmount = (flashcardCount: number): number => {
    if (flashcardCount < 5) {
      return 1;
    } else if (flashcardCount < 10) {
      return 5;
    } else if (flashcardCount < 25) {
      return 10;
    } else {
      return 25;
    }
  };

  // Handle claiming reward for completing a flashcard set
  const handleClaimReward = async () => {
    if (!selectedSet) return;

    const rewardAmount = getRewardAmount(selectedSet.words.length);

    try {
      const response = await fetch("/api/flashcard-sets/complete-reward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          flashcardSetId: selectedSet.id,
          rewardAmount,
        }),
      });

      if (response.ok) {
        await response.json();
        // Refresh claimed rewards from database
        await fetchClaimedRewards();
        // Refresh coins display
        fetchCoins();
      } else {
        const errorData = await response.json();
        console.error("Error claiming reward:", errorData.error);
        // Show error notification
        setNotification({
          message: errorData.error || "Failed to claim reward",
          type: "error",
          isVisible: true,
        });
        throw new Error(errorData.error || "Failed to claim reward");
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      throw error;
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
        alert(data.error || t("dashboard.failedDelete"));
      }
    } catch (error) {
      console.error("Error deleting flashcard set:", error);
      alert(t("dashboard.failedDelete"));
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
      setOpenSettingsId(null);
    }
  };

  const handleEditSet = async (setId: number) => {
    setLoadingEditId(setId);
    try {
      const response = await apiFetch(`/flashcard-sets/${setId}`);
      if (response.ok) {
        const data = await response.json();
        setEditingSetData(data.flashcardSet);
        setEditingSetId(setId);
        setOpenSettingsId(null);
      } else {
        alert(t("dashboard.failedLoadEdit"));
      }
    } catch (error) {
      console.error("Error loading flashcard set:", error);
      alert(t("dashboard.failedLoadEdit"));
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
  const studyTotal = selectedSet?.words.length ?? 0;
  const learnedCount = Math.max(0, studyTotal - studyQueue.length);
  const currentWord = selectedSet?.words.find(
    (word) => word.id === studyQueue[0]
  );
  const displayedCardNumber =
    studyTotal === 0
      ? 0
      : studyQueue.length > 0
        ? Math.min(learnedCount + 1, studyTotal)
        : studyTotal;

  // Prefetch all images and audio for the open set (stored separately from word records)
  useEffect(() => {
    if (!selectedSet || viewMode !== "cards") {
      setMediaLoading(false);
      return;
    }

    const abort = new AbortController();
    let cancelled = false;

    const imageIds = [
      ...new Set(
        selectedSet.words
          .map((w) => w.imageId)
          .filter(
            (id): id is number =>
              id != null && !imageCacheRef.current[id]
          )
      ),
    ];
    const audioIds = [
      ...new Set(
        selectedSet.words
          .map((w) => w.audioId)
          .filter(
            (id): id is number =>
              id != null && !audioCacheRef.current[id]
          )
      ),
    ];

    const total = imageIds.length + audioIds.length;
    if (total === 0) {
      setMediaLoading(false);
      setMediaLoadProgress({
        loaded: 0,
        total: 0,
        imageTotal: 0,
        audioTotal: 0,
      });
      return;
    }

    const imageTotal = imageIds.length;
    const audioTotal = audioIds.length;

    setMediaLoading(true);
    setMediaLoadProgress({
      loaded: 0,
      total,
      imageTotal,
      audioTotal,
    });

    let loaded = 0;
    const markLoaded = () => {
      if (cancelled) return;
      loaded += 1;
      setMediaLoadProgress({ loaded, total, imageTotal, audioTotal });
      if (loaded >= total) setMediaLoading(false);
    };

    const fetchImage = async (id: number) => {
      try {
        const response = await apiFetch(`/word-images/${id}`, {
          signal: abort.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.image?.dataUrl) {
            setImageCache((prev) => ({ ...prev, [id]: data.image.dataUrl }));
            imageCacheRef.current[id] = data.image.dataUrl;
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error fetching image:", error);
        }
      } finally {
        markLoaded();
      }
    };

    const fetchAudio = async (id: number) => {
      try {
        const response = await apiFetch(`/word-audio/${id}`, {
          signal: abort.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.audio?.dataUrl) {
            setAudioCache((prev) => ({ ...prev, [id]: data.audio.dataUrl }));
            audioCacheRef.current[id] = data.audio.dataUrl;
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error fetching audio:", error);
        }
      } finally {
        markLoaded();
      }
    };

    imageIds.forEach((id) => void fetchImage(id));
    audioIds.forEach((id) => void fetchAudio(id));

    return () => {
      cancelled = true;
      abort.abort();
      setMediaLoading(false);
    };
  }, [selectedSet?.id, viewMode]);

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Sidebar — fixed full height, no scroll */}
      <div className="w-72 shrink-0 h-screen bg-white dark:bg-gray-800/80 dark:backdrop-blur shadow-xl border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight mb-1 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                DuoCards
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                {t("nav.welcomeBack", { name: user.nickname })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  setShowSettingsModal(true);
                  window.dispatchEvent(new CustomEvent("closeAIChat"));
                }}
                className="group shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 active:scale-[0.98] dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                title={t("settings.title")}
                aria-label={t("settings.title")}
              >
                <svg className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                title={t("nav.logout")}
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("nav.flashcardSetsCount")}
            </span>
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              {flashcardSets.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("nav.totalWords")}
            </span>
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              {totalWords}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("nav.aiCoins")}
            </span>
            <span className="text-xl font-semibold text-purple-600 dark:text-purple-400">
              {coins !== null ? coins : "..."}
            </span>
          </div>
          {/* Daily Reward Button */}
          <div className="mt-2">
            <DailyRewardButton onCoinsUpdate={fetchCoins} />
          </div>

        </div>

        {/* Navigation Links */}
        <div className="p-4 shrink-0">
          <nav className="space-y-1">
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
                {t("nav.flashcardSetsCount")}
              </div>
            </button>
            {/* Statistics button - commented out */}
            {/* <button className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer active:scale-[0.98]">
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
            </button> */}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("closeAIChat"));
                setViewMode("library");
              }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer active:scale-[0.98] ${
                viewMode === "library"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-3 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                {t("nav.publicLibrary")}
              </div>
            </button>
            <button
              onClick={() => {
                setShowJoinModal(true);
                // Close AI chat if open
                window.dispatchEvent(new CustomEvent("closeAIChat"));
              }}
              className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
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
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                {t("nav.publicCodes")}
              </div>
            </button>
            <button
              onClick={() => {
                // Close AI chat if open
                window.dispatchEvent(new CustomEvent("closeAIChat"));
                router.push("/live-game");
              }}
              className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-3 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.868v4.264a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  <span className="block font-medium">{t("nav.liveGame")}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-normal">
                    {t("nav.liveGameHint")}
                  </span>
                </span>
              </div>
            </button>
            {getGuestLiveGameBaseUrl() ? (
              <a
                href={getGuestLiveGameBaseUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("closeAIChat"))
                }
                className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer active:scale-[0.98] block"
              >
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-3 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span>
                    <span className="block font-medium">{t("nav.guestLiveGame")}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 font-normal">
                    {t("nav.guestLiveGameHint")}
                    </span>
                  </span>
                </div>
              </a>
            ) : null}
          </nav>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        {viewMode === "library" ? (
          <PublicLibraryPanel onSetAdded={fetchFlashcardSets} />
        ) : viewMode === "liveHistory" ? (
          <LiveGameHistoryPanel />
        ) : viewMode === "sets" ? (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
                  {t("dashboard.title")}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("dashboard.subtitle")}
                  <span className="mx-2 text-gray-300 dark:text-gray-600">
                    ·
                  </span>
                  {t("dashboard.setsCount", { count: flashcardSets.length })}
                </p>
              </div>
              {!showCreateForm && !showAIGenerateForm && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (flashcardSets.length >= 100) {
                        alert(t("dashboard.maxSets"));
                        return;
                      }
                      setShowCreateForm(true);
                      setShowAIGenerateForm(false);
                    }}
                    disabled={flashcardSets.length >= 100}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-medium shadow-sm hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
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
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    {t("dashboard.newSet")}
                  </button>
                  <button
                    onClick={() => {
                      if (flashcardSets.length >= 100) {
                        alert(t("dashboard.maxSets"));
                        return;
                      }
                      setShowAIGenerateForm(true);
                      setShowCreateForm(false);
                    }}
                    disabled={flashcardSets.length >= 100}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium shadow-md shadow-purple-600/25 hover:shadow-lg hover:shadow-purple-600/35 hover:brightness-110 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    {t("dashboard.aiGenerate")}
                  </button>
                </div>
              )}
            </div>

            {/* Inline create / AI-generate forms */}
            {(showCreateForm || showAIGenerateForm) && (
              <div className="mb-6">
                {showCreateForm ? (
                  <InlineCreateFlashcardSetForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setShowCreateForm(false)}
                    onCoinsUpdate={fetchCoins}
                  />
                ) : (
                  <InlineAIGenerateForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setShowAIGenerateForm(false)}
                  />
                )}
              </div>
            )}

            {/* Filters toolbar */}
            {flashcardSets.length > 0 && (
              <div className="mb-6 rounded-2xl bg-white/70 dark:bg-gray-800/60 backdrop-blur border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[220px]">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("dashboard.searchPlaceholder")}
                      className="w-full px-4 py-2 pl-10 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900/60 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg
                      className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                    )}
                  </div>
                  {/* Language pair */}
                  <div className="flex items-center gap-2">
                    <select
                      value={filterFromLanguage}
                      aria-label={t("createSet.fromLanguage")}
                      onChange={(e) => {
                        setFiltering(true);
                        setFilterFromLanguage(e.target.value);
                        setTimeout(() => setFiltering(false), 300);
                      }}
                      className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900/60 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="">{t("dashboard.fromAll")}</option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {getLanguageLabel(lang.value, locale)}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0"
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
                    <select
                      value={filterToLanguage}
                      aria-label={t("createSet.toLanguage")}
                      onChange={(e) => {
                        setFiltering(true);
                        setFilterToLanguage(e.target.value);
                        setTimeout(() => setFiltering(false), 300);
                      }}
                      className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900/60 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="">{t("dashboard.toAll")}</option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {getLanguageLabel(lang.value, locale)}
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
                        className="px-3 py-2 text-xs font-medium rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        {t("dashboard.clearFilters")}
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
                          {t("dashboard.filtering")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags filter (capped, expandable) */}
                {(() => {
                  const allTags = new Set<string>();
                  flashcardSets.forEach((set) => {
                    if (set.isAIGenerated) allTags.add(AI_GENERATED_TAG);
                    set.tags?.forEach((tag) => {
                      const normalizedTag = tag.trim();
                      if (normalizedTag) allTags.add(normalizedTag);
                    });
                  });
                  const tagsArray = Array.from(allTags).sort();
                  if (tagsArray.length === 0) return null;

                  const TAG_LIMIT = 10;
                  // Selected tags stay visible even when collapsed
                  const visibleTags = showAllTags
                    ? tagsArray
                    : tagsArray
                        .filter(
                          (tag, idx) =>
                            idx < TAG_LIMIT || selectedTags.includes(tag)
                        )
                        .slice(0, Math.max(TAG_LIMIT, selectedTags.length));
                  const hiddenCount = tagsArray.length - visibleTags.length;

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {visibleTags.map((tag) => (
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
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                              : tag === AI_GENERATED_TAG
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {tag === AI_GENERATED_TAG
                            ? t("dashboard.aiGenerated")
                            : tag}
                        </button>
                      ))}
                      {(hiddenCount > 0 || showAllTags) && (
                        <button
                          onClick={() => setShowAllTags((prev) => !prev)}
                          className="px-3 py-1 text-xs rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          {showAllTags
                            ? t("dashboard.collapseTags")
                            : t("dashboard.showAllTags", { count: hiddenCount })}
                        </button>
                      )}
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
                  {t("dashboard.noSets")}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t("dashboard.noSetsHint")}
                </p>
                <button
                  onClick={() => {
                    if (flashcardSets.length >= 100) {
                      alert(t("dashboard.maxSets"));
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
                  {t("dashboard.createFirstSet")}
                </button>
              </div>
            ) : (
              <>
                {(() => {
                  // Filter flashcard sets based on search query, language filters and tags
                  let filteredSets = flashcardSets;

                  // Apply search query filter
                  if (searchQuery.trim()) {
                    filteredSets = filteredSets.filter((set) =>
                      set.name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  }

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
                      if (set.isAIGenerated) setTags.add(AI_GENERATED_TAG);
                      set.tags?.forEach((tag) => setTags.add(tag));

                      // Check if any selected tag matches
                      return selectedTags.some((tag) => setTags.has(tag));
                    });
                  }

                  return filteredSets;
                })().length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(() => {
                      // Filter flashcard sets based on search query, language filters and tags
                      let filteredSets = flashcardSets;

                      // Apply search query filter
                      if (searchQuery.trim()) {
                        filteredSets = filteredSets.filter((set) =>
                          set.name
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                        );
                      }

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
                          if (set.isAIGenerated) setTags.add(AI_GENERATED_TAG);
                          set.tags?.forEach((tag) => setTags.add(tag));

                          // Check if any selected tag matches
                          return selectedTags.some((tag) => setTags.has(tag));
                        });
                      }

                      return filteredSets;
                    })().map((set) => (
                      <div
                        key={set.id}
                        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all p-6 text-left border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 relative ${openSettingsId === set.id ? "z-30" : "z-0"}`}
                      >
                        <button
                          onClick={() => handleSetClick(set)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white min-w-0 break-words">
                              {set.name}
                            </h3>
                            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0">
                              {set.words.length}{" "}
                              {set.words.length === 1 ? t("dashboard.card") : t("dashboard.cards")}
                            </div>
                          </div>
                          {/* Tags */}
                          {(() => {
                            const displayTags = Array.from(
                              new Set(
                                (set.tags || [])
                                  .map((tag) => tag.trim())
                                  .filter(Boolean),
                              ),
                            );
                            // Keep one canonical AI tag even for older sets
                            // where it was derived instead of stored.
                            if (
                              set.isAIGenerated &&
                              !displayTags.includes(AI_GENERATED_TAG)
                            ) {
                              displayTags.unshift(AI_GENERATED_TAG);
                            }
                            return displayTags.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                {displayTags.slice(0, 5).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded-full text-xs ${
                                      tag === AI_GENERATED_TAG
                                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    {tag === AI_GENERATED_TAG
                                      ? t("dashboard.aiGenerated")
                                      : tag}
                                  </span>
                                ))}
                                {displayTags.length > 5 && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    +{displayTags.length - 5}
                                  </span>
                                )}
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
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t("dashboard.created", { date: new Date(set.createdAt).toLocaleDateString() })}
                            </p>
                            {/* Show public code only if set is public (not for shared sets) */}
                            {set.isPublic && set.publicCode && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {t("createSet.publicCode")}:
                                </span>
                                <span className="text-xs font-mono font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                                  {set.publicCode}
                                </span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(
                                      set.publicCode || ""
                                    );
                                  }}
                                  className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                  title={t("dashboard.copyCode")}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(
                                        set.publicCode || ""
                                      );
                                    }
                                  }}
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
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                </span>
                              </div>
                            )}
                            {/* Joined sets: show the origin public code so it's easy to find without searching the library */}
                            {!set.isPublic && set.joinedFromCode && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {t("createSet.publicCode")}:
                                </span>
                                <span className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">
                                  {set.joinedFromCode}
                                </span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(
                                      set.joinedFromCode || ""
                                    );
                                  }}
                                  className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                  title={t("dashboard.copyCode")}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(
                                        set.joinedFromCode || ""
                                      );
                                    }
                                  }}
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
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                </span>
                              </div>
                            )}
                          </div>
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
                            title={t("dashboard.settings")}
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
                                      {t("dashboard.deleteQuestion")}
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
                                            {t("dashboard.deleting")}
                                          </>
                                        ) : (
                                          t("common.yes")
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
                                        {t("common.no")}
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
                                          {t("dashboard.loadingEdit")}
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
                                          {t("dashboard.change")}
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
                                          {t("common.delete")}
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
                      {t("dashboard.noResults")}
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
                        {t("dashboard.clearFilters")}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 py-4">
            {/* Header: back, set name, progress, loading status */}
            <div className="shrink-0 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 mb-3 items-center">
              <button
                onClick={handleBackToSets}
                className="self-center flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer active:scale-[0.98] shrink-0"
              >
                <svg
                  className="w-5 h-5 mr-1"
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
                  {t("common.back")}
              </button>
              <h2 className="col-start-2 text-lg font-semibold text-gray-900 dark:text-white truncate leading-tight">
                {selectedSet?.name}
              </h2>
              <div className="col-start-3 flex items-center justify-end gap-2">
                <span
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium tabular-nums text-gray-500 dark:bg-gray-700/70 dark:text-gray-300"
                  aria-label={`${t("nav.currentCard")} ${
                    selectedSet && selectedSet.words.length > 0
                      ? `${displayedCardNumber} / ${selectedSet.words.length}`
                      : "0 / 0"
                  }`}
                >
                  {selectedSet && selectedSet.words.length > 0
                    ? `${displayedCardNumber}/${selectedSet.words.length}`
                    : "0/0"}
                </span>
                {mediaLoading && (
                  <div
                    className="flex items-center gap-1.5 rounded-md bg-white/95 dark:bg-gray-800/95 backdrop-blur px-2.5 py-1 border border-gray-200 dark:border-gray-600"
                    role="status"
                    aria-live="polite"
                  >
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0"
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
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {mediaLoadProgress.imageTotal > 0 &&
                      mediaLoadProgress.audioTotal > 0
                        ? t("dashboard.loadingImagesAudio")
                        : mediaLoadProgress.imageTotal > 0
                          ? t("dashboard.loadingImages")
                          : mediaLoadProgress.audioTotal > 0
                            ? t("dashboard.loadingAudio")
                            : t("common.loading")}
                      {mediaLoadProgress.total > 0
                        ? ` (${mediaLoadProgress.loaded}/${mediaLoadProgress.total})`
                        : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Flashcard display — fills remaining viewport height */}
            <div className="flex-1 min-h-0 flex items-center justify-center relative">
              {selectedSet && currentWord ? (
                <>
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
                    onDontKnow={handleDontKnow}
                    onKnow={handleKnow}
                    learnedCount={learnedCount}
                    totalCount={studyTotal}
                  />
                </>
              ) : selectedSet &&
                selectedSet.words.length > 0 &&
                studyQueue.length === 0 ? (
                <>
                  <div className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white/90 px-6 py-10 text-center shadow-xl backdrop-blur dark:border-emerald-800 dark:bg-gray-800/90">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <svg
                        className="h-9 w-9"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      {t("flashcard.learned")} {studyTotal}/{studyTotal}
                    </p>
                    <h3 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
                      {t("flashcard.allLearned")}
                    </h3>
                    <p className="mb-7 text-gray-600 dark:text-gray-300">
                      {t("flashcard.studyComplete")}
                    </p>
                    <button
                      type="button"
                      onClick={handleRestartStudy}
                      className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-700 active:scale-95"
                    >
                      {t("flashcard.studyAgain")}
                    </button>
                  </div>
                  <MoneyBagReward
                    rewardAmount={getRewardAmount(selectedSet.words.length)}
                    onClaim={handleClaimReward}
                    isLastCard={true}
                    isAlreadyClaimed={claimedRewards.has(selectedSet.id)}
                  />
                </>
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
                    {t("dashboard.noCardsInSet")}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {t("dashboard.emptySet")}
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

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onOpenCoinGuide={() => {
          setShowSettingsModal(false);
          setShowCostsModal(true);
        }}
        onOpenLiveGameHistory={() => {
          setShowSettingsModal(false);
          window.dispatchEvent(new CustomEvent("closeAIChat"));
          setViewMode("liveHistory");
        }}
      />

      {showJoinModal && (
        <JoinPublicSetModal
          onClose={() => setShowJoinModal(false)}
          onSuccess={() => {
            fetchFlashcardSets();
            setShowJoinModal(false);
          }}
        />
      )}

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
            isPublic: editingSetData.isPublic || false,
            publicCode: editingSetData.publicCode || null,
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

      {/* Notification */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={() => setNotification({ ...notification, isVisible: false })}
      />
    </div>
  );
}
