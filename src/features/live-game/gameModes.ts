import {
  LEGACY_GAME_MODE_IDS,
  type LegacyGameModeId,
  type LiveGameCategory,
  type LiveGamePacing,
  type LiveGameV2ModeId,
} from "./contracts";

type Translate = (key: string) => string;

export { LEGACY_GAME_MODE_IDS };
export type { LegacyGameModeId };

const LEGACY_MODE_TRANSLATIONS: Record<
  LegacyGameModeId,
  { label: string; description: string }
> = {
  practice: {
    label: "liveGame.modePractice",
    description: "liveGame.modePracticeDesc",
  },
  classic_duel: {
    label: "liveGame.modeClassic",
    description: "liveGame.modeClassicDesc",
  },
  speed_run: {
    label: "liveGame.modeSpeed",
    description: "liveGame.modeSpeedDesc",
  },
  team_battle: {
    label: "liveGame.modeTeam",
    description: "liveGame.modeTeamDesc",
  },
  survival: {
    label: "liveGame.modeSurvival",
    description: "liveGame.modeSurvivalDesc",
  },
};

export function getLegacyGameModeMeta(t: Translate, id: LegacyGameModeId) {
  const translations = LEGACY_MODE_TRANSLATIONS[id];
  return {
    id,
    label: t(translations.label),
    description: t(translations.description),
  };
}

export interface LiveGameDefinition {
  id: LiveGameV2ModeId;
  version: number;
  pacing: LiveGamePacing;
  category: LiveGameCategory;
  minPlayers: number;
  recommendedPlayers: readonly [number, number];
  defaultQuestionCount: number;
  defaultQuestionTimeSeconds: number;
}

export const LIVE_GAME_DEFINITIONS: Record<
  LiveGameV2ModeId,
  LiveGameDefinition
> = {
  classic_arena: {
    id: "classic_arena",
    version: 1,
    pacing: "synchronized",
    category: "quick",
    minPlayers: 1,
    recommendedPlayers: [2, 100],
    defaultQuestionCount: 10,
    defaultQuestionTimeSeconds: 20,
  },
  accuracy: {
    id: "accuracy",
    version: 1,
    pacing: "synchronized",
    category: "study",
    minPlayers: 1,
    recommendedPlayers: [1, 100],
    defaultQuestionCount: 10,
    defaultQuestionTimeSeconds: 30,
  },
  co_op_mission: {
    id: "co_op_mission",
    version: 1,
    pacing: "self-paced",
    category: "team",
    minPlayers: 1,
    recommendedPlayers: [1, 100],
    defaultQuestionCount: 15,
    defaultQuestionTimeSeconds: 30,
  },
  streak_combo: {
    id: "streak_combo",
    version: 1,
    pacing: "synchronized",
    category: "quick",
    minPlayers: 1,
    recommendedPlayers: [2, 100],
    defaultQuestionCount: 10,
    defaultQuestionTimeSeconds: 20,
  },
  survival: {
    id: "survival",
    version: 1,
    pacing: "synchronized",
    category: "strategy",
    minPlayers: 1,
    recommendedPlayers: [3, 100],
    defaultQuestionCount: 15,
    defaultQuestionTimeSeconds: 15,
  },
  team_battle: {
    id: "team_battle",
    version: 1,
    pacing: "synchronized",
    category: "team",
    minPlayers: 2,
    recommendedPlayers: [4, 100],
    defaultQuestionCount: 10,
    defaultQuestionTimeSeconds: 20,
  },
  risk_bet: {
    id: "risk_bet",
    version: 1,
    pacing: "synchronized",
    category: "strategy",
    minPlayers: 1,
    recommendedPlayers: [2, 100],
    defaultQuestionCount: 10,
    defaultQuestionTimeSeconds: 20,
  },
};

/** Modes the host can start from the create dialog right now. */
export const SELECTABLE_LIVE_GAME_MODE_IDS = [
  "classic_arena",
  "streak_combo",
  "survival",
  "team_battle",
  "risk_bet",
] as const satisfies readonly LiveGameV2ModeId[];

export type SelectableLiveGameModeId =
  (typeof SELECTABLE_LIVE_GAME_MODE_IDS)[number];

export const LIVE_GAME_MODE_TRANSLATIONS: Record<
  SelectableLiveGameModeId,
  { label: string; description: string }
> = {
  classic_arena: {
    label: "liveGameV2.classicTitle",
    description: "liveGameV2.classicDesc",
  },
  streak_combo: {
    label: "liveGameV2.streakTitle",
    description: "liveGameV2.streakDesc",
  },
  survival: {
    label: "liveGameV2.survivalTitle",
    description: "liveGameV2.survivalDesc",
  },
  team_battle: {
    label: "liveGameV2.teamTitle",
    description: "liveGameV2.teamDesc",
  },
  risk_bet: {
    label: "liveGameV2.riskTitle",
    description: "liveGameV2.riskDesc",
  },
};
