"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Message, Realtime, RealtimeChannel } from "ably";
import Flashcard from "@/components/Flashcard";

type ChatMessage = {
  id: string;
  from: string;
  text: string;
  at: string;
};

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const merged = [...existing];
  const seen = new Set(existing.map((m) => m.id));

  for (const message of incoming) {
    if (!seen.has(message.id)) {
      merged.push(message);
      seen.add(message.id);
    }
  }

  merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return merged;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O, 1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function channelNameForRoom(code: string) {
  return `duocards-live-${normalizeCode(code)}`;
}

/** Placeholder modes — replace with real logic later */
const GAME_MODES = [
  {
    id: "practice",
    label: "Practice",
    description:
      "Everyone in the room studies the same cards — flip them at your own pace.",
  },
  { id: "classic_duel", label: "Classic duel", description: "Take turns — fastest correct answer wins the round." },
  { id: "speed_run", label: "Speed run", description: "Race through as many cards as you can in a time limit." },
  { id: "team_battle", label: "Team battle", description: "Split into teams and compete for the highest score." },
  { id: "survival", label: "Survival", description: "Wrong answer eliminates you — last player standing wins." },
] as const;

type GameModeId = (typeof GAME_MODES)[number]["id"];

type PracticeWord = {
  word: string;
  translation: string;
  difficulty: number;
  pronunciation?: string | null;
};

type LiveGameSettings = {
  gameMode: GameModeId;
  gameModeLabel: string;
  flashcardSetIds: number[];
  flashcardSets: { id: number; name: string; wordCount: number }[];
  sessionDurationMinutes: number;
  /** ISO timestamp when the session ends; null = no time limit */
  sessionEndsAt: string | null;
  liveChatEnabled: boolean;
  /** Populated for practice mode — sent to all players so joiners can study host’s sets */
  practiceWords?: PracticeWord[];
};

const SESSION_DURATION_OPTIONS = [
  { value: 0, label: "No time limit" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
] as const;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

type FlashcardSetListItem = {
  id: number;
  name: string;
  words: { id: number }[];
};

function LiveGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [connectionState, setConnectionState] = useState("idle");
  const [onlineCount, setOnlineCount] = useState(0);
  const [messageInput, setMessageInput] = useState("");
  const [nickname, setNickname] = useState("Guest");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<{
    publish: (name: string, data: unknown) => Promise<unknown>;
  } | null>(null);
  const clientId = useMemo(
    () => `duocards-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createGameMode, setCreateGameMode] = useState<GameModeId>(
    GAME_MODES[0].id
  );
  const [selectedSetIds, setSelectedSetIds] = useState<number[]>([]);
  const [flashcardSetsList, setFlashcardSetsList] = useState<
    FlashcardSetListItem[]
  >([]);
  const [loadingFlashcardSets, setLoadingFlashcardSets] = useState(false);
  const [flashcardSetsError, setFlashcardSetsError] = useState<string | null>(
    null
  );
  const [liveGameSettings, setLiveGameSettings] =
    useState<LiveGameSettings | null>(null);
  const [receivedGameSettings, setReceivedGameSettings] =
    useState<LiveGameSettings | null>(null);
  const isRoomHostRef = useRef(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] =
    useState<number>(30);
  const [liveChatEnabled, setLiveChatEnabled] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [sessionRemainingSec, setSessionRemainingSec] = useState<number | null>(
    null
  );

  // Deep-link: /live-game?room=XXXXXX
  useEffect(() => {
    const fromUrl = searchParams.get("room");
    if (!fromUrl) return;
    const normalized = normalizeCode(fromUrl);
    if (normalized.length < 4) return;
    // Host just created this room and updated the URL — don’t wipe host state.
    if (roomCode === normalized) return;

    isRoomHostRef.current = false;
    setLiveGameSettings(null);
    setReceivedGameSettings(null);
    setRoomCode(normalized);
  }, [searchParams, roomCode]);

  const fetchFlashcardSetsForModal = async () => {
    setLoadingFlashcardSets(true);
    setFlashcardSetsError(null);
    try {
      const res = await fetch("/api/flashcard-sets");
      if (res.status === 401) {
        setFlashcardSetsError("You must be logged in to use your flashcard sets.");
        setFlashcardSetsList([]);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load flashcard sets");
      }
      const data = await res.json();
      const list = (data.flashcardSets || []) as FlashcardSetListItem[];
      setFlashcardSetsList(list);
    } catch {
      setFlashcardSetsError("Could not load flashcard sets.");
      setFlashcardSetsList([]);
    } finally {
      setLoadingFlashcardSets(false);
    }
  };

  useEffect(() => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const parsed = JSON.parse(userData) as { nickname?: string };
      if (parsed.nickname?.trim()) {
        setNickname(parsed.nickname.trim());
      }
    } catch {
      // Keep fallback nickname
    }
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      void fetchFlashcardSetsForModal();
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (!roomCode) {
      setMessages([]);
      setOnlineCount(0);
      setConnectionState("idle");
      channelRef.current = null;
      return;
    }

    let isMounted = true;
    let cancelled = false;
    let client: Realtime | null = null;
    let channel: RealtimeChannel | null = null;

    const initAbly = async () => {
      try {
        setError(null);
        setConnectionState("connecting");
        setMessages([]);

        const { Realtime } = await import("ably");
        if (cancelled) return;

        const channelName = channelNameForRoom(roomCode);
        const hostSettings = liveGameSettings;
        const isHost = isRoomHostRef.current;

        client = new Realtime({
          authUrl: `/api/ably/token?clientId=${encodeURIComponent(clientId)}`,
        });
        channel = client.channels.get(channelName);

        const refreshPresenceCount = async () => {
          const members = await channel!.presence.get();
          if (isMounted && !cancelled) {
            setOnlineCount(members.length);
          }
        };

        const mapAblyMessage = (message: Message): ChatMessage => {
          const payload = message.data as
            | { from?: string; text?: string; at?: string }
            | undefined;
          const fromTs =
            typeof message.timestamp === "number"
              ? new Date(message.timestamp).toISOString()
              : undefined;
          const timestamp =
            payload?.at || fromTs || new Date().toISOString();
          return {
            id:
              message.id ||
              `${timestamp}-${payload?.from || "unknown"}-${payload?.text || ""}`,
            from: payload?.from || "unknown",
            text: payload?.text || "",
            at: timestamp,
          };
        };

        client.connection.on((stateChange: { current: string }) => {
          if (isMounted && !cancelled) {
            setConnectionState(stateChange.current);
          }
        });

        const history = await channel.history({
          start: Date.now() - 15 * 60 * 1000,
          direction: "forwards",
          limit: 200,
        });
        const historyMessages = (history.items || []).map(mapAblyMessage);
        if (isMounted && !cancelled) {
          setMessages((prev) => mergeMessages(prev, historyMessages));
        }

        await channel.subscribe("chat-message", (message: Message) => {
          if (!isMounted) return;
          const mapped = mapAblyMessage(message);
          setMessages((prev) => mergeMessages(prev, [mapped]));
        });

        await channel.subscribe("game-config", (message: Message) => {
          if (!isMounted || isRoomHostRef.current) return;
          const payload = message.data as Partial<LiveGameSettings> | undefined;
          if (
            payload &&
            Array.isArray(payload.flashcardSetIds) &&
            Array.isArray(payload.flashcardSets) &&
            payload.gameMode
          ) {
            const normalized: LiveGameSettings = {
              gameMode: payload.gameMode as GameModeId,
              gameModeLabel:
                payload.gameModeLabel ?? String(payload.gameMode),
              flashcardSetIds: payload.flashcardSetIds,
              flashcardSets: payload.flashcardSets,
              sessionDurationMinutes: payload.sessionDurationMinutes ?? 0,
              sessionEndsAt: payload.sessionEndsAt ?? null,
              liveChatEnabled: payload.liveChatEnabled !== false,
              ...(Array.isArray(payload.practiceWords) &&
              payload.practiceWords.length > 0
                ? { practiceWords: payload.practiceWords }
                : {}),
            };
            setReceivedGameSettings(normalized);
          }
        });

        if (cancelled) {
          client.close();
          return;
        }

        const activeChannel = channel;
        if (!activeChannel) {
          client.close();
          return;
        }

        await activeChannel.presence.subscribe("enter", refreshPresenceCount);
        await activeChannel.presence.subscribe("leave", refreshPresenceCount);
        await activeChannel.presence.enter({ clientId, nickname });
        await refreshPresenceCount();

        channelRef.current = {
          publish: async (name: string, data: unknown) =>
            activeChannel.publish(name, data),
        };

        if (isHost && hostSettings) {
          await activeChannel.publish("game-config", hostSettings);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to initialize Ably live connection."
          );
          setConnectionState("failed");
        }
      }
    };

    initAbly();

    return () => {
      isMounted = false;
      cancelled = true;
      channelRef.current = null;
      if (channel) {
        void channel.presence.leave().catch(() => {});
      }
      if (client) {
        client.close();
      }
    };
  }, [roomCode, clientId, nickname, liveGameSettings]);

  const syncUrlToRoom = (code: string | null) => {
    if (code) {
      router.replace(`/live-game?room=${encodeURIComponent(code)}`, {
        scroll: false,
      });
    } else {
      router.replace("/live-game", { scroll: false });
    }
  };

  const toggleSetSelected = (id: number) => {
    setSelectedSetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openCreateModal = () => {
    setCreateGameMode(GAME_MODES[0].id);
    setSelectedSetIds([]);
    setSessionDurationMinutes(30);
    setLiveChatEnabled(true);
    setFlashcardSetsError(null);
    setShowCreateModal(true);
  };

  const confirmCreateGame = async () => {
    if (selectedSetIds.length === 0) {
      setError("Choose at least one flashcard set for this live game.");
      return;
    }
    const modeMeta = GAME_MODES.find((m) => m.id === createGameMode)!;
    const pickedSets = flashcardSetsList.filter((s) =>
      selectedSetIds.includes(s.id)
    );

    setCreatingRoom(true);
    setError(null);

    try {
      let practiceWords: PracticeWord[] | undefined;
      if (createGameMode === "practice") {
        const collected: PracticeWord[] = [];
        for (const id of selectedSetIds) {
          const res = await fetch(`/api/flashcard-sets/${id}`);
          if (!res.ok) {
            throw new Error(`Could not load flashcard set (ID ${id}).`);
          }
          const data = await res.json();
          const words = data.flashcardSet?.words ?? [];
          for (const w of words) {
            collected.push({
              word: w.word,
              translation: w.translation,
              difficulty:
                typeof w.difficulty === "number" ? w.difficulty : 1,
              pronunciation: w.pronunciation ?? null,
            });
          }
        }
        const shuffled = shuffleArray(collected);
        if (shuffled.length === 0) {
          setError(
            "Practice mode needs at least one card. Add words to your selected sets."
          );
          return;
        }
        practiceWords = shuffled;
      }

      const sessionEndsAt =
        sessionDurationMinutes > 0
          ? new Date(
              Date.now() + sessionDurationMinutes * 60 * 1000
            ).toISOString()
          : null;

      const settings: LiveGameSettings = {
        gameMode: createGameMode,
        gameModeLabel: modeMeta.label,
        flashcardSetIds: [...selectedSetIds],
        flashcardSets: pickedSets.map((s) => ({
          id: s.id,
          name: s.name,
          wordCount: s.words?.length ?? 0,
        })),
        sessionDurationMinutes,
        sessionEndsAt,
        liveChatEnabled,
        ...(practiceWords ? { practiceWords } : {}),
      };

      setLiveGameSettings(settings);
      isRoomHostRef.current = true;
      setPracticeIndex(0);

      const code = generateRoomCode();
      setRoomCode(code);
      syncUrlToRoom(code);
      setJoinInput("");
      setShowCreateModal(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create room. Try again."
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinGame = () => {
    const code = normalizeCode(joinInput);
    if (code.length < 4) {
      setError("Enter a valid game code (at least 4 characters).");
      return;
    }
    isRoomHostRef.current = false;
    setLiveGameSettings(null);
    setReceivedGameSettings(null);
    setRoomCode(code);
    syncUrlToRoom(code);
    setError(null);
  };

  const handleLeaveGame = () => {
    isRoomHostRef.current = false;
    setRoomCode(null);
    syncUrlToRoom(null);
    setJoinInput("");
    setError(null);
    setLiveGameSettings(null);
    setReceivedGameSettings(null);
    setCreateGameMode(GAME_MODES[0].id);
    setSelectedSetIds([]);
    setPracticeIndex(0);
    setSessionRemainingSec(null);
  };

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const sendMessage = async () => {
    if (!channelRef.current || !messageInput.trim() || !roomCode) return;
    const settings = liveGameSettings ?? receivedGameSettings;
    if (settings?.liveChatEnabled === false) return;

    const text = messageInput.trim();
    setMessageInput("");

    try {
      await channelRef.current.publish("chat-message", {
        from: nickname,
        text,
        at: new Date().toISOString(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish message."
      );
    }
  };

  const inLobby = !roomCode;

  const displayGameSettings =
    liveGameSettings || receivedGameSettings;
  /** Host session has local settings; joiners only have receivedGameSettings */
  const isHostUi = !!liveGameSettings;

  const practiceWords = displayGameSettings?.practiceWords ?? [];
  const isPracticeMode =
    displayGameSettings?.gameMode === "practice" &&
    practiceWords.length > 0;
  const currentPracticeCard = isPracticeMode
    ? practiceWords[practiceIndex]
    : null;
  const sessionEnded =
    displayGameSettings?.sessionEndsAt != null &&
    sessionRemainingSec !== null &&
    sessionRemainingSec <= 0;
  const chatEnabledForSession =
    !!roomCode &&
    (displayGameSettings ? displayGameSettings.liveChatEnabled !== false : true);

  useEffect(() => {
    setPracticeIndex(0);
  }, [
    roomCode,
    displayGameSettings?.gameMode,
    displayGameSettings?.practiceWords?.length,
  ]);

  useEffect(() => {
    const endsAt = displayGameSettings?.sessionEndsAt;
    if (!endsAt) {
      setSessionRemainingSec(null);
      return;
    }
    const end = new Date(endsAt).getTime();
    const tick = () => {
      const rem = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setSessionRemainingSec(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [displayGameSettings?.sessionEndsAt]);

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Main area — grows; chat stays at bottom */}
      <div className="flex-1 p-6 md:p-8 pb-4">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mb-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Dashboard
          </button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Live Game
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            {inLobby
              ? "Create a new session or join friends with a code."
              : "You’re in a live room. Share the code so others can join."}
          </p>

          {inLobby ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-2xl border-2 border-blue-500/40 bg-white dark:bg-gray-800 shadow-lg p-8 text-left hover:border-blue-500 hover:shadow-xl transition-all active:scale-[0.99] cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Create a live game
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get a room code you can share. Everyone with the code joins the
                  same room and chat.
                </p>
              </button>

              <div className="rounded-2xl border-2 border-indigo-500/40 bg-white dark:bg-gray-800 shadow-lg p-8 flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Join a live game
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Enter the 6-character code from your host.
                </p>
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) =>
                    setJoinInput(e.target.value.toUpperCase().slice(0, 8))
                  }
                  placeholder="e.g. AB12XY"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-lg tracking-widest text-center mb-3"
                />
                <button
                  type="button"
                  onClick={handleJoinGame}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors cursor-pointer"
                >
                  Join with code
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Room code
                  </span>
                  <span className="font-mono text-xl font-bold text-gray-900 dark:text-white tracking-widest">
                    {roomCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyRoomCode()}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Copy
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleLeaveGame}
                  className="text-sm px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Leave game
                </button>
              </div>

              {sessionEnded && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                  Session time is up. You can keep browsing cards or leave the
                  room when you’re done.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white/80 dark:bg-gray-800/80">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Connection
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                    {connectionState}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white/80 dark:bg-gray-800/80">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Players online
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {onlineCount}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white/80 dark:bg-gray-800/80">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Session
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {!displayGameSettings ? (
                      "…"
                    ) : displayGameSettings.sessionDurationMinutes <= 0 ? (
                      "No time limit"
                    ) : sessionRemainingSec != null ? (
                      sessionEnded ? (
                        "Ended"
                      ) : (
                        <span className="tabular-nums">
                          {formatCountdown(sessionRemainingSec)} left
                        </span>
                      )
                    ) : (
                      `${displayGameSettings.sessionDurationMinutes} min`
                    )}
                  </p>
                  {displayGameSettings &&
                    displayGameSettings.sessionDurationMinutes > 0 && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Live chat:{" "}
                        {displayGameSettings.liveChatEnabled ? "On" : "Off"}
                      </p>
                    )}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 min-h-[160px] p-6">
                {displayGameSettings ? (
                  <>
                    {isPracticeMode && currentPracticeCard ? (
                      <div className="space-y-4">
                        <div className="text-center">
                          <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide">
                            Practice mode
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Tap the card to flip. Use arrows to move between
                            cards — everyone studies the same deck at their own
                            pace.
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                            Card {practiceIndex + 1} of {practiceWords.length}
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <div className="w-full max-w-lg">
                            <Flashcard
                              word={currentPracticeCard.word}
                              translation={currentPracticeCard.translation}
                              difficulty={currentPracticeCard.difficulty}
                              pronunciation={
                                currentPracticeCard.pronunciation
                              }
                              onNext={() =>
                                setPracticeIndex((i) =>
                                  Math.min(
                                    practiceWords.length - 1,
                                    i + 1
                                  )
                                )
                              }
                              onPrevious={() =>
                                setPracticeIndex((i) => Math.max(0, i - 1))
                              }
                              hasNext={
                                practiceIndex < practiceWords.length - 1
                              }
                              hasPrevious={practiceIndex > 0}
                            />
                          </div>
                        </div>
                        <details className="text-left text-xs text-gray-500 dark:text-gray-400">
                          <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                            Sets in this session
                          </summary>
                          <ul className="mt-2 space-y-1 pl-4 list-disc">
                            {displayGameSettings.flashcardSets.map((s) => (
                              <li key={s.id}>
                                {s.name} ({s.wordCount} cards)
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    ) : displayGameSettings.gameMode === "practice" ? (
                      <p className="text-center text-sm text-amber-700 dark:text-amber-300 py-8">
                        Practice mode was chosen but no card data arrived. Ask
                        the host to recreate the room, or reconnect.
                      </p>
                    ) : (
                      <div className="text-left space-y-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Game mode
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {displayGameSettings.gameModeLabel}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {displayGameSettings.gameMode}{" "}
                            {isHostUi ? "(you chose this)" : "(from host)"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Flashcard sets
                          </p>
                          <ul className="space-y-2">
                            {displayGameSettings.flashcardSets.map((s) => (
                              <li
                                key={s.id}
                                className="flex justify-between gap-2 text-sm text-gray-800 dark:text-gray-200 bg-white/80 dark:bg-gray-800/80 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600"
                              >
                                <span className="font-medium truncate">
                                  {s.name}
                                </span>
                                <span className="shrink-0 text-gray-500 dark:text-gray-400">
                                  {s.wordCount} cards
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Session:{" "}
                          {displayGameSettings.sessionDurationMinutes <= 0
                            ? "no limit"
                            : `${displayGameSettings.sessionDurationMinutes} min`}
                          {" · "}
                          Chat:{" "}
                          {displayGameSettings.liveChatEnabled ? "on" : "off"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Set IDs for your game logic:{" "}
                          <span className="font-mono">
                            {displayGameSettings.flashcardSetIds.join(", ")}
                          </span>
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full min-h-[120px] flex items-center justify-center">
                    <p className="text-center text-gray-500 dark:text-gray-400 text-sm max-w-md">
                      {isHostUi
                        ? "No game config — try rejoining as host."
                        : "Waiting for host to share game settings… If nothing appears, ask them to ensure they created the room from this app."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300 max-w-2xl">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Create game modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-live-game-title"
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2
                id="create-live-game-title"
                className="text-xl font-bold text-gray-900 dark:text-white"
              >
                Create a live game
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Pick a mode (placeholder for now) and which flashcard sets to
                use.
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Game mode
                </label>
                <div className="space-y-2">
                  {GAME_MODES.map((mode) => (
                    <label
                      key={mode.id}
                      className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        createGameMode === mode.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="gameMode"
                        value={mode.id}
                        checked={createGameMode === mode.id}
                        onChange={() => setCreateGameMode(mode.id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {mode.label}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {mode.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Session length
                </label>
                <select
                  value={sessionDurationMinutes}
                  onChange={(e) =>
                    setSessionDurationMinutes(Number(e.target.value))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  {SESSION_DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  When time runs out, everyone still sees a notice; practice /
                  cards stay available.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-600 p-4">
                <input
                  id="live-chat-enabled"
                  type="checkbox"
                  checked={liveChatEnabled}
                  onChange={(e) => setLiveChatEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-500"
                />
                <label
                  htmlFor="live-chat-enabled"
                  className="text-sm text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  <span className="font-medium">Enable live chat</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Turn off if you want a quieter session (no room messages).
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Flashcard sets{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                {loadingFlashcardSets ? (
                  <p className="text-sm text-gray-500">Loading your sets…</p>
                ) : flashcardSetsError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {flashcardSetsError}
                  </p>
                ) : flashcardSetsList.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You have no flashcard sets yet. Create some on the
                    dashboard first.
                  </p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
                    {flashcardSetsList.map((set) => {
                      const n = set.words?.length ?? 0;
                      const checked = selectedSetIds.includes(set.id);
                      return (
                        <li key={set.id}>
                          <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSetSelected(set.id)}
                              className="rounded border-gray-300 dark:border-gray-500"
                            />
                            <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
                              {set.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                              {n} cards
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {selectedSetIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedSetIds.length} set
                    {selectedSetIds.length === 1 ? "" : "s"} selected
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setError(null);
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmCreateGame()}
                disabled={
                  loadingFlashcardSets ||
                  flashcardSetsList.length === 0 ||
                  selectedSetIds.length === 0 ||
                  creatingRoom
                }
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
              >
                {creatingRoom ? "Preparing room…" : "Create room"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live chat — bottom (hidden when host disables chat) */}
      {!inLobby && roomCode && !chatEnabledForSession ? (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100/90 dark:bg-gray-900/95 py-3 px-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Live chat is off for this session (host disabled it).
          </p>
        </div>
      ) : (
        <div
          className={`border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-backdrop-filter:bg-white/90 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] ${inLobby ? "opacity-60 pointer-events-none" : ""}`}
        >
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Live chat {roomCode ? `· ${roomCode}` : ""}
              </h3>
              {inLobby && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Join or create a game to chat
                </span>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 h-40 overflow-y-auto p-3 mb-2 bg-gray-50 dark:bg-gray-800/50">
              {!roomCode ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
                  Chat unlocks after you create or join a game.
                </p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No messages yet. Say hi!
                </p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="mb-2 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {message.from}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {" "}
                      {message.text}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && roomCode && chatEnabledForSession) {
                    void sendMessage();
                  }
                }}
                placeholder={
                  roomCode ? "Message the room..." : "Create or join to chat"
                }
                disabled={!roomCode || !chatEnabledForSession}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!roomCode || !chatEnabledForSession}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiveGamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <p className="text-gray-600 dark:text-gray-400">Loading…</p>
        </div>
      }
    >
      <LiveGameContent />
    </Suspense>
  );
}
