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
};
