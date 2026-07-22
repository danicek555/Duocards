import type {
  LegacyLiveGameSettings,
  PracticeWord,
} from "./contracts";

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  at: string;
}

export function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const merged = [...existing];
  const seen = new Set(existing.map((message) => message.id));

  for (const message of incoming) {
    if (!seen.has(message.id)) {
      merged.push(message);
      seen.add(message.id);
    }
  }

  merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return merged;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function channelNameForRoom(code: string): string {
  return `duocards-live-${normalizeRoomCode(code)}`;
}

export function shuffleArray<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeLegacyGameConfig(
  payload: Partial<LegacyLiveGameSettings> | undefined,
): LegacyLiveGameSettings | null {
  if (
    !payload ||
    !Array.isArray(payload.flashcardSetIds) ||
    !Array.isArray(payload.flashcardSets) ||
    !payload.gameMode
  ) {
    return null;
  }

  const practiceWords = Array.isArray(payload.practiceWords)
    ? (payload.practiceWords as PracticeWord[])
    : [];

  return {
    gameMode: payload.gameMode,
    gameModeLabel: payload.gameModeLabel ?? String(payload.gameMode),
    flashcardSetIds: payload.flashcardSetIds,
    flashcardSets: payload.flashcardSets,
    sessionDurationMinutes: payload.sessionDurationMinutes ?? 0,
    sessionEndsAt: payload.sessionEndsAt ?? null,
    liveChatEnabled: payload.liveChatEnabled !== false,
    ...(practiceWords.length > 0 ? { practiceWords } : {}),
  };
}
