"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Message, Realtime, RealtimeChannel } from "ably";
import Flashcard from "@/components/Flashcard";
import { useLiveGameJoinOnly } from "@/contexts/LiveGameJoinOnlyContext";
import { isGuestLiveHostname } from "@/lib/liveGameHost";
import { getPublicAppUrlForUi } from "@/lib/publicUrls";
import {
  getContentViolationRetrySeconds,
  isContentViolationError,
} from "@/lib/contentViolationClient";

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

const SESSION_DURATION_OPTIONS = [5, 10, 15, 20, 25, 30].map((value) => ({
  value,
  label: `${value} minutes`,
})) as readonly { value: number; label: string }[];

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

/** Parse Ably game-config payload; shared by live subscription + channel history. */
function normalizeGameConfigPayload(
  payload: Partial<LiveGameSettings> | undefined
): LiveGameSettings | null {
  if (
    !payload ||
    !Array.isArray(payload.flashcardSetIds) ||
    !Array.isArray(payload.flashcardSets) ||
    !payload.gameMode
  ) {
    return null;
  }
  return {
    gameMode: payload.gameMode as GameModeId,
    gameModeLabel: payload.gameModeLabel ?? String(payload.gameMode),
    flashcardSetIds: payload.flashcardSetIds,
    flashcardSets: payload.flashcardSets,
    sessionDurationMinutes: payload.sessionDurationMinutes ?? 0,
    sessionEndsAt: payload.sessionEndsAt ?? null,
    liveChatEnabled: payload.liveChatEnabled !== false,
    ...(Array.isArray(payload.practiceWords) && payload.practiceWords.length > 0
      ? { practiceWords: payload.practiceWords }
      : {}),
  };
}

type FlashcardSetListItem = {
  id: number;
  name: string;
  words: { id: number }[];
};

type RoomMember = {
  clientId: string;
  nickname: string;
};

type GameEndSummary = {
  players: number;
  durationSec: number | null;
  plannedMinutes: number | null;
  modeLabel: string;
  endedAt: string;
};

type SessionEndedMessage = GameEndSummary & { endedByClientId: string };

function LiveGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinOnly = useLiveGameJoinOnly();
  const mainAppUrl = getPublicAppUrlForUi();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [connectionState, setConnectionState] = useState("idle");
  const [onlineCount, setOnlineCount] = useState(0);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [nickname, setNickname] = useState("Guest");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatBlockedUntil, setChatBlockedUntil] = useState<number | null>(null);
  const [chatBlockError, setChatBlockError] = useState<string | null>(null);
  const channelRef = useRef<{
    publish: (name: string, data: unknown) => Promise<unknown>;
  } | null>(null);
  const clientId = useMemo(
    () => `duocards-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const isChatBlocked =
    chatBlockedUntil !== null && Date.now() < chatBlockedUntil;

  useEffect(() => {
    if (!chatBlockedUntil) return;
    const remainingMs = chatBlockedUntil - Date.now();
    if (remainingMs <= 0) {
      setChatBlockedUntil(null);
      setChatBlockError(null);
      return;
    }
    const timer = setTimeout(() => {
      setChatBlockedUntil(null);
      setChatBlockError(null);
    }, remainingMs);
    return () => clearTimeout(timer);
  }, [chatBlockedUntil]);

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
  const [gameStarted, setGameStarted] = useState(false);
  const gameStartedRef = useRef(false);
  gameStartedRef.current = gameStarted;
  const [sessionDurationMinutes, setSessionDurationMinutes] =
    useState<number>(30);
  const [liveChatEnabled, setLiveChatEnabled] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [sessionRemainingSec, setSessionRemainingSec] = useState<number | null>(
    null
  );
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [gameEndDetails, setGameEndDetails] = useState<GameEndSummary | null>(
    null
  );
  const [showGameEndedModal, setShowGameEndedModal] = useState(false);
  const preventAutoJoinRef = useRef(false);

  /** Latest host settings for re-publishing when joiners enter presence */
  const liveGameSettingsRef = useRef<LiveGameSettings | null>(null);
  liveGameSettingsRef.current = liveGameSettings;

  const clearRoomAfterLeave = useCallback(() => {
    isRoomHostRef.current = false;
    setRoomCode(null);
    setJoinInput("");
    setError(null);
    setLiveGameSettings(null);
    setReceivedGameSettings(null);
    setGameStarted(false);
    gameStartedRef.current = false;
    setCreateGameMode(GAME_MODES[0].id);
    setSelectedSetIds([]);
    setPracticeIndex(0);
    setSessionRemainingSec(null);
    setSessionStartedAt(null);
  }, []);

  const onRemoteSessionEndedRef = useRef<(details: GameEndSummary) => void>(
    () => {}
  );
  onRemoteSessionEndedRef.current = (details: GameEndSummary) => {
    preventAutoJoinRef.current = true;
    setGameEndDetails(details);
    setShowGameEndedModal(true);
    clearRoomAfterLeave();
  };

  // Deep-link: ?room= on guest host (rewritten to /live) or /live-game?room= on main app
  useEffect(() => {
    const fromUrl = searchParams.get("room");
    if (!fromUrl) {
      if (preventAutoJoinRef.current) {
        preventAutoJoinRef.current = false;
      }
      return;
    }
    if (preventAutoJoinRef.current) {
      return;
    }
    const normalized = normalizeCode(fromUrl);
    if (normalized.length < 4) return;
    // Host just created this room and updated the URL — don’t wipe host state.
    if (roomCode === normalized) return;

    isRoomHostRef.current = false;
      setLiveGameSettings(null);
    setReceivedGameSettings(null);
    setGameStarted(false);
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
    if (joinOnly) return;
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
  }, [joinOnly]);

  useEffect(() => {
    if (!joinOnly) return;
    try {
      const saved = sessionStorage.getItem("live_game_guest_nickname");
      if (saved?.trim()) {
        setNickname(saved.trim());
      }
    } catch {
      // ignore
    }
  }, [joinOnly]);

  useEffect(() => {
    if (showCreateModal) {
      void fetchFlashcardSetsForModal();
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (!roomCode) {
      setMessages([]);
      setOnlineCount(0);
      setRoomMembers([]);
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
        const isHost = isRoomHostRef.current;

        client = new Realtime({
          authUrl: `/api/ably/token?clientId=${encodeURIComponent(clientId)}`,
        });
        channel = client.channels.get(channelName);

        const parsePresenceData = (data: unknown): { nickname?: string } => {
          if (data && typeof data === "object" && "nickname" in data) {
            const n = (data as { nickname?: unknown }).nickname;
            if (typeof n === "string" && n.trim()) return { nickname: n.trim() };
          }
          return {};
        };

        const refreshPresenceCount = async () => {
          const members = await channel!.presence.get();
          if (isMounted && !cancelled) {
            setOnlineCount(members.length);
          }
        };

        const refreshPresenceMembers = async () => {
          const members = await channel!.presence.get();
          if (!isMounted || cancelled) return;
          const list: RoomMember[] = members.map((m) => {
            const { nickname } = parsePresenceData(m.data);
            return {
              clientId: m.clientId ?? "",
              nickname: nickname || "Guest",
            };
          });
          list.sort((a, b) =>
            a.nickname.localeCompare(b.nickname, undefined, {
              sensitivity: "base",
            })
          );
          setRoomMembers(list);
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
        const historyItems = history.items || [];

        // Only merge real chat lines (game-config used separate event name)
        const chatHistoryItems = historyItems.filter(
          (m) => m.name === "chat-message" || m.name == null
        );
        const historyMessages = chatHistoryItems.map(mapAblyMessage);
        if (isMounted && !cancelled) {
          setMessages((prev) => mergeMessages(prev, historyMessages));
        }

        // Joiners: recover latest game-config from persistence (missed if host published before we subscribed)
        if (!isHost) {
          const configItems = historyItems.filter((m) => m.name === "game-config");
          if (configItems.length > 0) {
            const lastConfig = configItems[configItems.length - 1];
            const normalized = normalizeGameConfigPayload(
              lastConfig.data as Partial<LiveGameSettings> | undefined
            );
            if (normalized && isMounted && !cancelled) {
              setReceivedGameSettings(normalized);
            }
          }
        }

        await channel.subscribe("chat-message", (message: Message) => {
          if (!isMounted) return;
          const mapped = mapAblyMessage(message);
          setMessages((prev) => mergeMessages(prev, [mapped]));
        });

        await channel.subscribe("game-config", (message: Message) => {
          if (!isMounted || isRoomHostRef.current) return;
          const normalized = normalizeGameConfigPayload(
            message.data as Partial<LiveGameSettings> | undefined
          );
          if (normalized) {
            setReceivedGameSettings(normalized);
          }
        });

        await channel.subscribe("session-ended", (message: Message) => {
          if (!isMounted || cancelled) return;
          const raw = message.data as Partial<SessionEndedMessage> | undefined;
          if (!raw || typeof raw.endedByClientId !== "string") return;
          if (raw.endedByClientId === clientId) return;
          if (!raw.endedAt || typeof raw.endedAt !== "string") return;
          const details: GameEndSummary = {
            players: typeof raw.players === "number" ? raw.players : 1,
            durationSec:
              typeof raw.durationSec === "number"
                ? raw.durationSec
                : raw.durationSec === null
                  ? null
                  : null,
            plannedMinutes:
              typeof raw.plannedMinutes === "number"
                ? raw.plannedMinutes
                : raw.plannedMinutes === null
                  ? null
                  : null,
            modeLabel:
              typeof raw.modeLabel === "string" ? raw.modeLabel : "Live game",
            endedAt: raw.endedAt,
          };
          onRemoteSessionEndedRef.current(details);
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

        const handlePresenceChange = async () => {
          if (isMounted && !cancelled) {
            await refreshPresenceCount();
            await refreshPresenceMembers();
          }
          // Re-send config so joiners who connected after start still get cards/sets
          if (!isMounted || cancelled || !isRoomHostRef.current) return;
          if (!gameStartedRef.current) return;
          const settings = liveGameSettingsRef.current;
          if (!settings) return;
          try {
            await activeChannel.publish("game-config", settings);
          } catch (e) {
            console.error("Failed to re-publish game-config:", e);
          }
        };

        await activeChannel.presence.subscribe("enter", handlePresenceChange);
        await activeChannel.presence.subscribe("leave", handlePresenceChange);
        await activeChannel.presence.subscribe("update", handlePresenceChange);
        await activeChannel.presence.enter({ clientId, nickname });
        await refreshPresenceCount();
        await refreshPresenceMembers();

        channelRef.current = {
          publish: async (name: string, data: unknown) =>
            activeChannel.publish(name, data),
        };
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
    if (joinOnly) {
      const onGuestHost =
        typeof window !== "undefined" &&
        isGuestLiveHostname(window.location.hostname);
      if (onGuestHost) {
        if (code) {
          router.replace(`/?room=${encodeURIComponent(code)}`, {
            scroll: false,
          });
        } else {
          router.replace("/", { scroll: false });
        }
      } else {
        if (code) {
          router.replace(`/live?room=${encodeURIComponent(code)}`, {
            scroll: false,
          });
        } else {
          router.replace("/live", { scroll: false });
        }
      }
      return;
    }
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
    if (joinOnly) return;
    setCreateGameMode(GAME_MODES[0].id);
    setSelectedSetIds([]);
    setSessionDurationMinutes(30);
    setLiveChatEnabled(true);
    setFlashcardSetsError(null);
    setShowCreateModal(true);
  };

  const confirmCreateGame = async () => {
    if (joinOnly) return;
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

      const sessionEndsAt = new Date(
        Date.now() + sessionDurationMinutes * 60 * 1000
      ).toISOString();

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
      setGameStarted(false);
      gameStartedRef.current = false;
      setPracticeIndex(0);

      const code = generateRoomCode();
      preventAutoJoinRef.current = false;
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

  const closeGameEndedModal = () => {
    setShowGameEndedModal(false);
    setGameEndDetails(null);
    syncUrlToRoom(null);
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
    setGameStarted(false);
    gameStartedRef.current = false;
    preventAutoJoinRef.current = false;
    setRoomCode(code);
    syncUrlToRoom(code);
    setError(null);
  };

  const handleLeaveGame = async () => {
    preventAutoJoinRef.current = true;
    const settings = liveGameSettings ?? receivedGameSettings;
    const players = Math.max(1, roomMembers.length, onlineCount);
    const elapsedSec =
      sessionStartedAt != null
        ? Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000))
        : null;
    const details: GameEndSummary = {
      players,
      durationSec: elapsedSec,
      plannedMinutes: settings?.sessionDurationMinutes ?? null,
      modeLabel: settings?.gameModeLabel ?? "Live game",
      endedAt: new Date().toISOString(),
    };

    if (isRoomHostRef.current && channelRef.current) {
      try {
        await channelRef.current.publish("session-ended", {
          ...details,
          endedByClientId: clientId,
        });
      } catch (e) {
        console.error("Failed to notify players that the session ended:", e);
      }
    }

    setGameEndDetails(details);
    setShowGameEndedModal(true);
    clearRoomAfterLeave();
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
    if (!messageInput.trim() || !roomCode || isChatBlocked) return;
    const settings = liveGameSettings ?? receivedGameSettings;
    if (settings?.liveChatEnabled === false) return;

    const text = messageInput.trim();
    setMessageInput("");

    try {
      const res = await fetch("/api/live-game/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          text,
          from: nickname,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        const errMsg = data.error || "Failed to send message.";
        if (isContentViolationError(errMsg)) {
          setChatBlockError(errMsg);
          setChatBlockedUntil(
            Date.now() + getContentViolationRetrySeconds(res) * 1000
          );
        } else {
          setMessageInput(text);
          setError(errMsg);
        }
        return;
      }
      // Message is delivered via Ably subscription (server publish).
    } catch (err) {
      setMessageInput(text);
      setError(
        err instanceof Error ? err.message : "Failed to send message."
      );
    }
  };

  const inLobby = !roomCode;

  /** Host session has local settings; joiners only have receivedGameSettings */
  const isHostUi = !!liveGameSettings;
  /** Planned session (host has this in lobby; joiners after start) */
  const sessionSummarySettings = liveGameSettings ?? receivedGameSettings;
  /** Cards / playable UI only after host starts or joiner received config */
  const activeGameSettings = isHostUi
    ? gameStarted
      ? liveGameSettings
      : null
    : receivedGameSettings;

  const startGameAsHost = async () => {
    if (!liveGameSettings || !isRoomHostRef.current) return;
    if (!channelRef.current) {
      setError("Still connecting — wait a moment, then try again.");
      return;
    }
    setError(null);
    gameStartedRef.current = true;
    setGameStarted(true);
    try {
      await channelRef.current.publish("game-config", liveGameSettings);
      setSessionStartedAt(Date.now());
    } catch (e) {
      gameStartedRef.current = false;
      setGameStarted(false);
      setSessionStartedAt(null);
      setError(
        e instanceof Error ? e.message : "Could not start the game. Try again."
      );
    }
  };

  const practiceWords = activeGameSettings?.practiceWords ?? [];
  const isPracticeMode =
    activeGameSettings?.gameMode === "practice" &&
    practiceWords.length > 0;
  const currentPracticeCard = isPracticeMode
    ? practiceWords[practiceIndex]
    : null;
  const sessionEnded =
    activeGameSettings?.sessionEndsAt != null &&
    sessionRemainingSec !== null &&
    sessionRemainingSec <= 0;
  const chatEnabledForSession =
    !!roomCode &&
    (sessionSummarySettings
      ? sessionSummarySettings.liveChatEnabled !== false
      : true);

  useEffect(() => {
    if (!isHostUi && receivedGameSettings && sessionStartedAt === null) {
      setSessionStartedAt(Date.now());
    }
  }, [isHostUi, receivedGameSettings, sessionStartedAt]);

  useEffect(() => {
    setPracticeIndex(0);
  }, [
    roomCode,
    activeGameSettings?.gameMode,
    activeGameSettings?.practiceWords?.length,
  ]);

  useEffect(() => {
    const endsAt = activeGameSettings?.sessionEndsAt;
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
  }, [activeGameSettings?.sessionEndsAt]);

  useEffect(() => {
    if (roomCode && showGameEndedModal) {
      setShowGameEndedModal(false);
      setGameEndDetails(null);
    }
  }, [roomCode, showGameEndedModal]);

  useEffect(() => {
    if (!showGameEndedModal) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showGameEndedModal]);

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Main area — grows; chat stays at bottom */}
      <div
        className={`flex-1 flex flex-col ${inLobby ? "items-center justify-center px-4 py-10 md:py-16" : "p-6 md:p-8 pb-4"}`}
      >
        <div className="w-full max-w-3xl mx-auto">
          {joinOnly ? (
            mainAppUrl ? (
              <a
                href={mainAppUrl}
                className="mb-4 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Full DuoCards (sign in & host games)
              </a>
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mb-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Dashboard
            </button>
          )}

          <h1
            className={`text-3xl font-bold text-gray-900 dark:text-white mb-2 ${inLobby ? "text-center" : ""}`}
          >
            {joinOnly ? "Join a live game" : "Live Game"}
          </h1>
          <p
            className={`text-gray-600 dark:text-gray-300 mb-8 ${inLobby ? "text-center max-w-md mx-auto" : ""}`}
          >
            {inLobby
              ? joinOnly
                ? "Enter the code from your host. Hosting is available only on the main site when signed in."
                : "Create a new session or join friends with a code."
              : "You’re in a live room. Share the code so others can join."}
          </p>

          {inLobby ? (
            joinOnly ? (
              <div className="max-w-md mx-auto w-full space-y-6">
                <div>
                  <label
                    htmlFor="guest-nickname"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Your name in the room
                  </label>
                  <input
                    id="guest-nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) =>
                      setNickname(e.target.value.slice(0, 40))}
                    onBlur={() => {
                      try {
                        sessionStorage.setItem(
                          "live_game_guest_nickname",
                          nickname.trim(),
                        );
                      } catch {
                        /* ignore */
                      }
                    }}
                    maxLength={40}
                    placeholder="Guest"
                    autoComplete="off"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
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
                    Join with a code
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Enter the code from the host (signed in on DuoCards).
                  </p>
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) =>
                      setJoinInput(e.target.value.toUpperCase().slice(0, 8))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinGame();
                    }}
                    placeholder="e.g. AB12XY"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-lg tracking-widest text-center mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
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
                    Get a room code you can share. Everyone with the code joins
                    the same room and chat.
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinGame();
                    }}
                    placeholder="e.g. AB12XY"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-lg tracking-widest text-center mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            )
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

              {roomCode && connectionState === "connected" && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Players in this room
                  </p>
                  {roomMembers.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Syncing presence…
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {roomMembers.map((m) => (
                        <li
                          key={m.clientId}
                          className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                        >
                          <span className="font-medium">{m.nickname}</span>
                          {m.clientId === clientId && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              (you)
                            </span>
                          )}
                          {isHostUi &&
                            m.clientId === clientId &&
                            liveGameSettings && (
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                · Host
                              </span>
                            )}
                        </li>
                      ))}
                    </ul>
                  )}
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
                    {!sessionSummarySettings ? (
                      "…"
                    ) : sessionSummarySettings.sessionDurationMinutes <= 0 ? (
                      "—"
                    ) : sessionRemainingSec != null ? (
                      sessionEnded ? (
                        "Ended"
                      ) : (
                        <span className="tabular-nums">
                          {formatCountdown(sessionRemainingSec)} left
                        </span>
                      )
                    ) : (
                      `${sessionSummarySettings.sessionDurationMinutes} min`
                    )}
                  </p>
                  {sessionSummarySettings && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Live chat:{" "}
                      {sessionSummarySettings.liveChatEnabled ? "On" : "Off"}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 min-h-[160px] p-6">
                {isHostUi && liveGameSettings && !gameStarted ? (
                  <div className="space-y-6 text-left">
                    <div>
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                        Lobby
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Share the room code so friends can join. When everyone is
                        ready, start the game — players will get the same cards
                        and settings.
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 p-4 space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Mode
                        </p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {liveGameSettings.gameModeLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Sets
                        </p>
                        <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
                          {liveGameSettings.flashcardSets.map((s) => (
                            <li key={s.id}>
                              {s.name}{" "}
                              <span className="text-gray-500 dark:text-gray-400">
                                ({s.wordCount} cards)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void startGameAsHost()}
                      disabled={connectionState !== "connected"}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
                    >
                      Start game
                    </button>
                  </div>
                ) : activeGameSettings ? (
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
                            {activeGameSettings.flashcardSets.map((s) => (
                              <li key={s.id}>
                                {s.name} ({s.wordCount} cards)
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    ) : activeGameSettings.gameMode === "practice" ? (
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
                            {activeGameSettings.gameModeLabel}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {activeGameSettings.gameMode}{" "}
                            {isHostUi ? "(you chose this)" : "(from host)"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Flashcard sets
                          </p>
                          <ul className="space-y-2">
                            {activeGameSettings.flashcardSets.map((s) => (
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
                          {activeGameSettings.sessionDurationMinutes <= 0
                            ? "—"
                            : `${activeGameSettings.sessionDurationMinutes} min`}
                          {" · "}
                          Chat:{" "}
                          {activeGameSettings.liveChatEnabled ? "on" : "off"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Set IDs for your game logic:{" "}
                          <span className="font-mono">
                            {activeGameSettings.flashcardSetIds.join(", ")}
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
                        : "Waiting for the host to start the game… You’ll see the same mode and cards as everyone else once they press Start."}
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

      {/* Game ended modal */}
      {showGameEndedModal && gameEndDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-ended-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  Game ended
                </p>
                <h2
                  id="game-ended-title"
                  className="text-2xl font-bold text-gray-900 dark:text-white"
                >
                  Thanks for playing
                </h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(gameEndDetails.endedAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1">
                  Players
                </p>
                <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                  {gameEndDetails.players}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1">
                  Duration
                </p>
                <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                  {gameEndDetails.durationSec != null
                    ? formatCountdown(gameEndDetails.durationSec)
                    : gameEndDetails.plannedMinutes &&
                      gameEndDetails.plannedMinutes > 0
                    ? `${gameEndDetails.plannedMinutes} min planned`
                    : "—"}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Mode:{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {gameEndDetails.modeLabel}
              </span>
            </p>
            <div className="flex justify-end gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => closeGameEndedModal()}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                Close
              </button>
              {joinOnly ? (
                mainAppUrl ? (
                  <a
                    href={mainAppUrl}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white inline-flex items-center justify-center"
                  >
                    Open full DuoCards
                  </a>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeGameEndedModal();
                    router.push("/dashboard");
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white"
                >
                  Go to dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live chat — only inside a room (not on create/join dashboard) */}
      {!inLobby && roomCode && !chatEnabledForSession ? (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100/90 dark:bg-gray-900/95 py-3 px-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Live chat is off for this session (host disabled it).
          </p>
        </div>
      ) : !inLobby && roomCode ? (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-backdrop-filter:bg-white/90 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Live chat · {roomCode}
              </h3>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 h-40 overflow-y-auto p-3 mb-2 bg-gray-50 dark:bg-gray-800/50">
              {messages.length === 0 ? (
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
            {chatBlockError && (
              <div className="mb-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400">
                  {chatBlockError}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    roomCode &&
                    chatEnabledForSession &&
                    !isChatBlocked
                  ) {
                    void sendMessage();
                  }
                }}
                placeholder={
                  isChatBlocked
                    ? "Chat is paused — try again in a few minutes"
                    : "Message the room..."
                }
                disabled={!chatEnabledForSession || isChatBlocked}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!chatEnabledForSession || isChatBlocked}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
