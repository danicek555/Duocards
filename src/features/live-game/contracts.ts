import contractDefinition from "../../../contracts/live-game-v1.json";

export const LIVE_GAME_CONTRACT_VERSION =
  contractDefinition.contractVersion as 1;

export const LEGACY_GAME_MODE_IDS = [
  "practice",
  "classic_duel",
  "speed_run",
  "team_battle",
  "survival",
] as const;

export type LegacyGameModeId = (typeof LEGACY_GAME_MODE_IDS)[number];

export const LIVE_GAME_V2_MODE_IDS = contractDefinition.modeIds as unknown as
  readonly [
    "classic_arena",
    "accuracy",
    "co_op_mission",
    "streak_combo",
    "survival",
    "sprint",
    "marathon",
    "team_battle",
    "risk_bet",
  ];

export type LiveGameV2ModeId = (typeof LIVE_GAME_V2_MODE_IDS)[number];

export const LIVE_GAME_TEAM_IDS = ["RED", "BLUE"] as const;

export type LiveGameTeamId = (typeof LIVE_GAME_TEAM_IDS)[number];

export type LiveGameAnswerMode = "choice" | "typed";

/** Starting bank every risk_bet player receives on join (mirrors backend). */
export const RISK_BET_STARTING_BANK = 1_000;

export type LiveGamePacing = "synchronized" | "self-paced";
export type LiveGameCategory = "quick" | "team" | "strategy" | "study";

export type LiveGameSessionStatus =
  | "LOBBY"
  | "COUNTDOWN"
  | "QUESTION"
  | "LOCKED"
  | "REVEAL"
  | "SCOREBOARD"
  | "FINISHED";

export type LiveGameEventType =
  | "room.created"
  | "player.joined"
  | "game.started"
  | "round.started"
  | "answer.accepted"
  | "round.revealed"
  | "score.changed"
  | "game.finished";

export interface LiveGameEvent<TPayload = unknown> {
  contractVersion: typeof LIVE_GAME_CONTRACT_VERSION;
  sessionId: string;
  eventId: string;
  sequence: number;
  serverTime: string;
  type: LiveGameEventType;
  payload: TPayload;
}

export interface PracticeWord {
  word: string;
  translation: string;
  difficulty: number;
  pronunciation?: string | null;
}

/** Compatibility settings used by the current Ably prototype. */
export interface LegacyLiveGameSettings {
  gameMode: LegacyGameModeId;
  gameModeLabel: string;
  flashcardSetIds: number[];
  flashcardSets: { id: number; name: string; wordCount: number }[];
  sessionDurationMinutes: number;
  sessionEndsAt: string | null;
  liveChatEnabled: boolean;
  practiceWords?: PracticeWord[];
}

export interface LiveGameQuestionSnapshot {
  id: string;
  sequence: number;
  prompt: string;
  options: string[];
  startedAt: string | null;
  locksAt: string | null;
  answeredCount: number;
  correctAnswer?: string;
}

export interface LiveGameParticipantSnapshot {
  id: string;
  nickname: string;
  score: number;
  correct: number;
  total: number;
  /** Consecutive correct answers right now (streak_combo). */
  streak: number;
  bestStreak: number;
  /** Survival: knocked out, but may keep practicing. */
  eliminated: boolean;
  practiceCorrect: number;
  practiceTotal: number;
  /** Team battle: the participant's team, null in other modes. */
  team: LiveGameTeamId | null;
}

/** Player-scoped question for self-paced modes (no shared currentQuestion). */
export interface LiveGameSelfPacedViewerState {
  question: {
    id: string;
    sequence: number;
    prompt: string;
    options: string[];
  } | null;
  answeredCount: number;
}

export interface LiveGameSessionSnapshot {
  contractVersion: typeof LIVE_GAME_CONTRACT_VERSION;
  id: string;
  roomCode: string;
  modeId: LiveGameV2ModeId;
  modeVersion: number;
  status: LiveGameSessionStatus;
  sequence: number;
  totalQuestions: number;
  /** How players answer: pick one of the options, or type the translation. */
  answerMode: LiveGameAnswerMode;
  serverTime: string;
  currentQuestion: LiveGameQuestionSnapshot | null;
  /** Present for self-paced modes once the session has started. */
  selfPaced: { endsAt: string } | null;
  participants: LiveGameParticipantSnapshot[];
  viewer: {
    participantId: string;
    currentAnswer: {
      roundId: string;
      answer: string;
      isCorrect: boolean;
      points: number;
    } | null;
    selfPaced?: LiveGameSelfPacedViewerState;
  } | null;
}

export interface CreateLiveGameSessionRequest {
  modeId: LiveGameV2ModeId;
  flashcardSetIds: number[];
  questionCount: number;
  questionTimeSeconds: number;
  /** Marathon only: how long the room stays open after start. */
  durationMinutes?: number;
  answerMode?: LiveGameAnswerMode;
}

export interface JoinLiveGameSessionRequest {
  roomCode: string;
  nickname: string;
}

export interface SubmitLiveGameAnswerRequest {
  roundId: string;
  answer: string;
  idempotencyKey: string;
  /** Risk mode: the stake taken from the player's bank for this question. */
  bet?: number;
}

export interface SelectLiveGameTeamRequest {
  team: LiveGameTeamId;
}

export function isLiveGameV2ModeId(value: string): value is LiveGameV2ModeId {
  return (LIVE_GAME_V2_MODE_IDS as readonly string[]).includes(value);
}
