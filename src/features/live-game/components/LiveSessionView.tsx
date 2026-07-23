"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type {
  LiveGameParticipantSnapshot,
  LiveGameSessionSnapshot,
  LiveGameTeamId,
} from "../contracts";
import { LIVE_GAME_TEAM_IDS } from "../contracts";
import type { LiveGameClientRole } from "../sessionStorage";
import {
  isLiveSoundMuted,
  playCorrect,
  playCountdownTick,
  playFanfare,
  playIncorrect,
  playQuestionStart,
  setLiveSoundMuted,
} from "../sound";
import InviteQrCode from "./InviteQrCode";

export type LiveConnectionState = "connected" | "reconnecting" | "offline";
export type LiveAction = "start" | "advance" | "answer" | "team" | "finish" | null;
export type LiveResultsSavedState = "saving" | "saved" | "error" | null;

interface LiveSessionViewProps {
  session: LiveGameSessionSnapshot;
  role: LiveGameClientRole;
  connection: LiveConnectionState;
  action: LiveAction;
  copied: boolean;
  error: string | null;
  inviteUrl: string | null;
  resultsSaved: LiveResultsSavedState;
  onCopyInvite: () => void;
  onStart: () => void;
  onAdvance: () => void;
  onAnswer: (answer: string, bet?: number) => void;
  onSelectTeam: (team: LiveGameTeamId) => void;
  onFinish: () => void;
  onLeave: () => void;
}

const TEAM_META: Record<
  LiveGameTeamId,
  { labelKey: string; chip: string; card: string; bar: string }
> = {
  RED: {
    labelKey: "liveGameV2.teamRed",
    chip: "bg-rose-400/15 text-rose-300 border-rose-300/25",
    card: "border-rose-300/25 bg-rose-500/10",
    bar: "bg-rose-400",
  },
  BLUE: {
    labelKey: "liveGameV2.teamBlue",
    chip: "bg-sky-400/15 text-sky-300 border-sky-300/25",
    card: "border-sky-300/25 bg-sky-500/10",
    bar: "bg-sky-400",
  },
};

interface TeamStanding {
  team: LiveGameTeamId;
  players: number;
  /** Average score per player, so team size does not decide the battle. */
  average: number;
}

function computeTeamStandings(
  participants: readonly LiveGameParticipantSnapshot[],
): TeamStanding[] {
  return LIVE_GAME_TEAM_IDS.map((team) => {
    const members = participants.filter((participant) => participant.team === team);
    const sum = members.reduce((total, member) => total + member.score, 0);
    return {
      team,
      players: members.length,
      average: members.length > 0 ? Math.round(sum / members.length) : 0,
    };
  }).sort((a, b) => b.average - a.average);
}

function TeamChip({ team }: { team: LiveGameTeamId }) {
  const { t } = useI18n();
  const meta = TEAM_META[team];
  return (
    <span className={`ms-2 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide align-middle ${meta.chip}`}>
      {t(meta.labelKey)}
    </span>
  );
}

function TeamStandingsPanel({ session }: { session: LiveGameSessionSnapshot }) {
  const { t } = useI18n();
  const standings = computeTeamStandings(session.participants);
  const best = Math.max(1, ...standings.map((standing) => standing.average));
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {standings.map((standing) => {
        const meta = TEAM_META[standing.team];
        return (
          <div key={standing.team} className={`rounded-2xl border p-4 ${meta.card}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-black uppercase tracking-wide">{t(meta.labelKey)}</span>
              <span className="text-xs font-medium text-slate-300">
                {t("liveGameV2.teamPlayers", { count: standing.players })}
              </span>
            </div>
            <p className="mt-2 font-mono text-2xl font-black text-white">{standing.average}</p>
            <p className="text-[11px] font-medium text-slate-300">{t("liveGameV2.teamAvg")}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${meta.bar}`}
                style={{ width: `${Math.round((standing.average / best) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CONFETTI_COLORS = ["#3b82f6", "#8b5cf6", "#22d3ee", "#fbbf24", "#34d399"];

function ConfettiBurst() {
  const pieces = useMemo(() =>
    Array.from({ length: 70 }, (_, index) => ({
      left: (index * 37) % 100,
      delay: ((index * 13) % 24) / 10,
      duration: 2.6 + ((index * 7) % 18) / 10,
      rotate: (index * 53) % 360,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      width: 6 + ((index * 11) % 6),
    })), []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <style>{`@keyframes live-confetti-fall{0%{transform:translateY(-6vh) rotate(0deg);opacity:1}85%{opacity:1}100%{transform:translateY(104vh) rotate(720deg);opacity:0}}`}</style>
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="absolute top-0 block rounded-sm"
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.width * 1.6,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotate}deg)`,
            animation: `live-confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function ResultsTable({ session }: { session: LiveGameSessionSnapshot }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-105 border-separate border-spacing-y-2 text-start">
        <thead>
          <tr className="text-xs font-bold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-1 text-start">#</th>
            <th className="px-3 py-1 text-start">{t("liveGameV2.resultPlayer")}</th>
            <th className="px-3 py-1 text-end">{t("liveGameV2.resultScore")}</th>
            <th className="px-3 py-1 text-end">{t("liveGameV2.resultCorrect")}</th>
            <th className="px-3 py-1 text-end">{t("liveGameV2.resultAccuracy")}</th>
          </tr>
        </thead>
        <tbody>
          {session.participants.map((participant, index) => {
            const accuracy = participant.total > 0
              ? Math.round((participant.correct / participant.total) * 100)
              : null;
            const isWinner = index === 0 && participant.score > 0 && !participant.eliminated;
            return (
              <tr key={participant.id} className={`rounded-2xl ${isWinner ? "bg-amber-400/15" : participant.eliminated ? "bg-white/[0.03] opacity-70" : "bg-white/[0.06]"}`}>
                <td className={`rounded-s-2xl px-3 py-3 font-black ${isWinner ? "text-amber-300" : "text-slate-300"}`}>{index + 1}</td>
                <td className="min-w-0 break-words px-3 py-3 font-bold text-white">
                  {participant.nickname}
                  {participant.team && <TeamChip team={participant.team} />}
                  {isWinner && (
                    <span className="ms-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950">
                      {t("liveGameV2.winnerTag")}
                    </span>
                  )}
                  {participant.eliminated && (
                    <span className="ms-2 rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300">
                      {t("liveGameV2.eliminatedTag")}
                    </span>
                  )}
                  {participant.practiceTotal > 0 && (
                    <span className="mt-1 block text-[11px] font-medium text-slate-400">
                      {t("liveGameV2.practiceScore", { correct: participant.practiceCorrect, total: participant.practiceTotal })}
                    </span>
                  )}
                  {session.modeId === "streak_combo" && participant.bestStreak > 1 && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-orange-300">
                      <StreakFlame className="h-3 w-3" />
                      {t("liveGameV2.bestStreak", { count: participant.bestStreak })}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-end font-mono text-lg font-black text-cyan-200">{participant.score}</td>
                <td className="px-3 py-3 text-end font-mono text-sm text-slate-200">{participant.correct}/{participant.total}</td>
                <td className="rounded-e-2xl px-3 py-3 text-end font-mono text-sm text-slate-200">{accuracy === null ? "—" : `${accuracy}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StreakFlame({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? "h-4 w-4"} fill="currentColor">
      <path d="M12 2c1.2 4.2-3.6 6-3.6 10.4a4.6 4.6 0 0 0 9.2 0C17.6 8.6 13.4 7.4 12 2zm.1 16.6a2.3 2.3 0 0 1-2.3-2.3c0-1.7 1.5-2.5 2.2-4 .8 1.5 2.4 2.3 2.4 4a2.3 2.3 0 0 1-2.3 2.3z" />
    </svg>
  );
}

/** Multiplier the NEXT correct answer will earn (mirrors the backend ladder). */
function nextStreakMultiplier(streak: number): string {
  const value = 1 + Math.min(streak, 4) * 0.5;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** mm:ss for sprints, h:mm:ss / d + h:mm:ss once marathons get long. */
function formatCountdown(msLeft: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msLeft / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}:${mmss}`;
  if (hours > 0) return `${hours}:${mmss}`;
  return mmss;
}

function Scoreboard({ session }: { session: LiveGameSessionSnapshot }) {
  const { t } = useI18n();
  if (session.participants.length === 0) {
    return <p className="text-sm text-slate-400">{t("liveGameV2.noScoreYet")}</p>;
  }

  return (
    <ol className="space-y-2">
      {session.participants.map((participant, index) => {
        const accuracy = participant.total > 0
          ? Math.round((participant.correct / participant.total) * 100)
          : 0;
        return (
          <li key={participant.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 ${participant.eliminated ? "bg-white/[0.02] opacity-60" : "bg-white/[0.06]"}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${index === 0 && !participant.eliminated ? "bg-amber-400 text-amber-950" : "bg-white/10 text-slate-300"}`}>
              {index + 1}
            </span>
            <span className="min-w-0 break-words font-bold text-white">
              {participant.nickname}
              {participant.team && <TeamChip team={participant.team} />}
              {session.modeId === "streak_combo" && participant.streak > 1 && (
                <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-orange-400/15 px-2 py-0.5 text-[10px] font-black text-orange-300 align-middle">
                  <StreakFlame className="h-3 w-3" />
                  {participant.streak}
                </span>
              )}
              {participant.eliminated && (
                <span className="ms-2 rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300 align-middle">
                  {t("liveGameV2.eliminatedTag")}
                </span>
              )}
            </span>
            <span className="text-end">
              <span className="block font-mono text-lg font-black text-cyan-200">{participant.score}</span>
              <span className="block text-[10px] font-medium text-slate-400">{accuracy}%</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ConnectionBadge({ state }: { state: LiveConnectionState }) {
  const { t } = useI18n();
  const label = state === "connected"
    ? t("liveGameV2.connected")
    : state === "reconnecting"
      ? t("liveGameV2.reconnecting")
      : t("liveGameV2.offline");
  const classes = state === "connected"
    ? "bg-emerald-400/15 text-emerald-200 border-emerald-300/20"
    : state === "reconnecting"
      ? "bg-amber-400/15 text-amber-100 border-amber-300/20"
      : "bg-red-400/15 text-red-100 border-red-300/20";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${classes}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${state === "connected" ? "bg-emerald-300" : state === "reconnecting" ? "bg-amber-300 animate-pulse" : "bg-red-300"}`} />
      {label}
    </span>
  );
}

export default function LiveSessionView({
  session,
  role,
  connection,
  action,
  copied,
  error,
  inviteUrl,
  resultsSaved,
  onCopyInvite,
  onStart,
  onAdvance,
  onAnswer,
  onSelectTeam,
  onFinish,
  onLeave,
}: LiveSessionViewProps) {
  const { t } = useI18n();
  const [clock, setClock] = useState(() => Date.now());
  const [muted, setMuted] = useState(() => isLiveSoundMuted());
  const [codeCopied, setCodeCopied] = useState(false);
  const [confirming, setConfirming] = useState<"finish" | "leave" | null>(null);
  const [bet, setBet] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState("");
  const isHost = role === "host";
  const question = session.currentQuestion;
  const viewerAnswer = session.viewer?.currentAnswer ?? null;
  const me = session.viewer
    ? session.participants.find((participant) => participant.id === session.viewer?.participantId) ?? null
    : null;
  const aliveCount = session.participants.filter((participant) => !participant.eliminated).length;
  const isSurvival = session.modeId === "survival";
  const isStreakMode = session.modeId === "streak_combo";
  const isSelfPaced = session.modeId === "sprint" || session.modeId === "marathon";
  const spViewer = session.viewer?.selfPaced ?? null;
  const spQuestion = spViewer?.question ?? null;
  const spMsLeft = session.selfPaced
    ? Math.max(0, new Date(session.selfPaced.endsAt).getTime() - clock)
    : null;
  const isTeamBattle = session.modeId === "team_battle";
  const isRiskMode = session.modeId === "risk_bet";
  const isTypedMode = session.answerMode === "typed";

  // A new question resets the stake and the typed draft.
  useEffect(() => {
    setBet(0);
    setTypedAnswer("");
  }, [question?.id]);

  useEffect(() => {
    if (session.status !== "QUESTION") return;
    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [session.status, question?.id]);

  const secondsLeft = useMemo(() => {
    if (!question?.locksAt) return 0;
    return Math.max(0, Math.ceil((new Date(question.locksAt).getTime() - clock) / 1_000));
  }, [clock, question?.locksAt]);

  // Zvuky: nová otázka, tikání posledních vteřin, vyhodnocení, fanfára.
  const lastTickRef = useRef(0);
  useEffect(() => {
    if (session.status === "QUESTION" && (question?.id || spQuestion?.id)) {
      playQuestionStart();
    }
  }, [session.status, question?.id, spQuestion?.id]);
  useEffect(() => {
    if (session.status !== "QUESTION" || secondsLeft <= 0 || secondsLeft > 5) return;
    if (lastTickRef.current === secondsLeft) return;
    lastTickRef.current = secondsLeft;
    playCountdownTick(secondsLeft);
  }, [secondsLeft, session.status]);
  // Sprint: tick through the last five seconds of the whole session.
  const spSecondsLeft = spMsLeft === null ? null : Math.ceil(spMsLeft / 1_000);
  useEffect(() => {
    if (
      session.modeId !== "sprint" ||
      session.status !== "QUESTION" ||
      spSecondsLeft === null ||
      spSecondsLeft <= 0 ||
      spSecondsLeft > 5
    ) {
      return;
    }
    if (lastTickRef.current === spSecondsLeft) return;
    lastTickRef.current = spSecondsLeft;
    playCountdownTick(spSecondsLeft);
  }, [session.modeId, session.status, spSecondsLeft]);
  useEffect(() => {
    if (session.status !== "REVEAL" || isHost) return;
    if (viewerAnswer?.isCorrect) playCorrect();
    else playIncorrect();
    // Jedno vyhodnocení na kolo — otázka se při REVEAL nemění.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, question?.id]);
  useEffect(() => {
    if (session.status === "FINISHED") playFanfare();
  }, [session.status]);

  const toggleMute = () => {
    setMuted((current) => {
      setLiveSoundMuted(!current);
      return !current;
    });
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(session.roomCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2_000);
    } catch {
      // Klávesová alternativa: kód je viditelný a dá se označit ručně.
    }
  };

  const requestLeave = () => {
    if (isHost && session.status !== "FINISHED") setConfirming("leave");
    else onLeave();
  };

  const leaveButton = (
    <button type="button" onClick={requestLeave} disabled={action !== null} className="rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
      {session.status === "FINISHED" ? t("liveGameV2.backToHub") : t("liveGameV2.leave")}
    </button>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -start-20 top-0 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -end-24 bottom-0 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur-lg">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{t("liveGameV2.roomCode")}</span>
            <span className="font-mono text-xl font-black tracking-[0.2em] text-white">{session.roomCode}</span>
            <ConnectionBadge state={connection} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t("liveGameV2.soundUnmute") : t("liveGameV2.soundMute")}
              aria-pressed={!muted}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
            >
              {muted ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H3v6h3l5 4V5ZM22 9l-6 6M16 9l6 6" />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H3v6h3l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              )}
            </button>
            {isHost && session.status !== "FINISHED" && session.status !== "LOBBY" && (
              <button
                type="button"
                onClick={() => setConfirming("finish")}
                disabled={action !== null}
                className="rounded-xl border border-red-300/20 px-3 py-2 text-sm font-bold text-red-200 transition hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {action === "finish" ? t("liveGameV2.ending") : t("liveGameV2.endGame")}
              </button>
            )}
            {leaveButton}
          </div>
        </header>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        {session.status === "LOBBY" && (
          <section className="mx-auto grid max-w-5xl gap-6 py-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-blue-300/20 bg-gradient-to-br from-blue-500/20 to-violet-500/10 p-7 shadow-2xl shadow-blue-950/30 sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-cyan-300">{t("liveGameV2.lobby")}</p>
              <h1 className="mt-4 text-3xl font-black sm:text-5xl">{t("liveGameV2.shareCode")}</h1>
              <div className="relative my-8 rounded-3xl border border-white/15 bg-slate-950/55 px-5 py-7 text-center font-mono text-4xl font-black tracking-[0.22em] text-white sm:text-6xl">
                {session.roomCode}
                <button
                  type="button"
                  onClick={() => void copyRoomCode()}
                  aria-label={t("liveGameV2.copyCode")}
                  className="absolute end-3 top-3 flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 font-sans text-xs font-bold tracking-normal text-slate-200 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 cursor-pointer"
                >
                  {codeCopied ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m4.5 12.5 5 5 10-11" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                  {codeCopied ? t("liveGameV2.copied") : t("liveGameV2.copyCode")}
                </button>
              </div>
              {isHost ? (
                <>
                  <button type="button" onClick={onCopyInvite} className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-bold transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 cursor-pointer">
                    {copied ? t("liveGameV2.copied") : t("liveGameV2.copyLink")}
                  </button>
                  {inviteUrl && (
                    <>
                      <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{t("liveGameV2.scanToJoin")}</p>
                      <InviteQrCode url={inviteUrl} label={t("liveGameV2.qrLabel")} />
                    </>
                  )}
                  <p className="mt-4 text-sm leading-6 text-slate-300">{t("liveGameV2.hostLobbyHint")}</p>
                </>
              ) : (
                <p className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{t("liveGameV2.playerLobbyHint")}</p>
              )}
            </div>

            <div className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.06] p-6 sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">{t("liveGameV2.waitingPlayers")}</h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-200">{session.participants.length}</span>
              </div>
              {isTeamBattle && !isHost && me && (
                <fieldset className="mb-4">
                  <legend className="mb-2 text-sm font-bold text-slate-200">{t("liveGameV2.chooseTeam")}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {LIVE_GAME_TEAM_IDS.map((team) => {
                      const meta = TEAM_META[team];
                      const selected = me.team === team;
                      const members = session.participants.filter((participant) => participant.team === team).length;
                      return (
                        <button
                          key={team}
                          type="button"
                          onClick={() => onSelectTeam(team)}
                          disabled={action !== null || selected || connection !== "connected"}
                          aria-pressed={selected}
                          className={`rounded-2xl border p-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed ${meta.card} ${selected ? "ring-2 ring-white" : "cursor-pointer hover:brightness-125"}`}
                        >
                          <span className="block text-sm font-black uppercase tracking-wide">{t(meta.labelKey)}</span>
                          <span className="mt-1 block text-xs font-medium text-slate-300">{t("liveGameV2.teamPlayers", { count: members })}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {session.participants.length === 0 ? (
                <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center text-sm leading-6 text-slate-400">{t("liveGameV2.noPlayers")}</p>
              ) : (
                <ul className="flex-1 space-y-2">
                  {session.participants.map((participant, index) => (
                    <li key={participant.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-400/15 text-sm font-black text-blue-200">{index + 1}</span>
                      <span className="min-w-0 break-words font-bold">
                        {participant.nickname}
                        {isTeamBattle && participant.team && <TeamChip team={participant.team} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {isHost && (
                <button type="button" onClick={onStart} disabled={action !== null || session.participants.length === 0 || connection !== "connected"} className="mt-5 w-full rounded-2xl bg-blue-500 px-5 py-3.5 font-black text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                  {action === "start" ? t("liveGameV2.starting") : t("liveGameV2.startGame")}
                </button>
              )}
            </div>
          </section>
        )}

        {isSelfPaced && session.status === "QUESTION" && (
          <section className="mx-auto max-w-5xl py-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-2">
                {!isHost && spViewer && (
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-200">
                    {t("liveGameV2.selfPacedProgress", {
                      answered: spViewer.answeredCount,
                      total: session.totalQuestions,
                    })}
                  </span>
                )}
                <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                  {session.modeId === "sprint"
                    ? t("liveGameV2.sprintBadge")
                    : t("liveGameV2.marathonBadge")}
                </span>
              </span>
              <span
                className={`rounded-2xl px-4 py-2 font-mono text-xl font-black ${
                  spMsLeft !== null && spMsLeft <= 15_000
                    ? "bg-amber-400/20 text-amber-100"
                    : "bg-blue-400/15 text-blue-100"
                }`}
                aria-live="polite"
              >
                {spMsLeft !== null ? formatCountdown(spMsLeft) : "—"}
              </span>
            </div>

            {isHost ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-3xl border border-blue-300/20 bg-gradient-to-br from-blue-500/20 to-violet-500/10 p-7 sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
                    {t("liveGameV2.roomCode")}
                  </p>
                  <p className="mt-3 font-mono text-4xl font-black tracking-[0.2em]">{session.roomCode}</p>
                  <p className="mt-5 text-sm leading-6 text-slate-200">
                    {session.modeId === "sprint"
                      ? t("liveGameV2.sprintHostHint")
                      : t("liveGameV2.marathonHostHint")}
                  </p>
                </div>
                <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                  <h2 className="mb-4 text-xl font-black">{t("liveGameV2.scoreboard")}</h2>
                  <Scoreboard session={session} />
                </aside>
              </div>
            ) : spQuestion ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 sm:p-8">
                <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
                  {t("liveGameV2.chooseAnswer")}
                </p>
                <h1 className="mx-auto mb-8 max-w-3xl break-words text-center text-3xl font-black leading-tight sm:text-5xl">
                  {spQuestion.prompt}
                </h1>
                <div className="grid gap-3 sm:grid-cols-2">
                  {spQuestion.options.map((option, index) => {
                    const base = [
                      "border-blue-300/25 bg-blue-500/15 hover:bg-blue-500/25",
                      "border-violet-300/25 bg-violet-500/15 hover:bg-violet-500/25",
                      "border-cyan-300/25 bg-cyan-500/15 hover:bg-cyan-500/25",
                      "border-amber-300/25 bg-amber-500/15 hover:bg-amber-500/25",
                    ][index % 4];
                    return (
                      <button
                        key={`${spQuestion.id}-${index}-${option}`}
                        type="button"
                        onClick={() => onAnswer(option)}
                        disabled={
                          action !== null ||
                          connection !== "connected" ||
                          (spMsLeft !== null && spMsLeft <= 0)
                        }
                        className={`min-h-20 cursor-pointer rounded-2xl border p-4 text-center text-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60 ${base}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {me && (
                  <p className="mt-6 text-center text-sm font-bold text-slate-300" aria-live="polite">
                    {t("liveGameV2.selfPacedScore", { correct: me.correct, score: me.score })}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-7 text-center sm:p-9">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">
                    {t("liveGameV2.selfPacedDoneTitle")}
                  </p>
                  <h1 className="mt-4 text-3xl font-black sm:text-4xl">
                    {t("liveGameV2.selfPacedDoneHint")}
                  </h1>
                  {me && (
                    <p className="mt-5 font-mono text-xl font-black text-emerald-100">
                      {t("liveGameV2.selfPacedScore", { correct: me.correct, score: me.score })}
                    </p>
                  )}
                </div>
                <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                  <h2 className="mb-4 text-xl font-black">{t("liveGameV2.scoreboard")}</h2>
                  <Scoreboard session={session} />
                </aside>
              </div>
            )}
          </section>
        )}

        {session.status === "QUESTION" && question && (
          <section className="mx-auto max-w-5xl py-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-200">
                  {t("liveGameV2.questionProgress", { current: question.sequence, total: session.totalQuestions })}
                </span>
                {isSurvival && (
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
                    {t("liveGameV2.aliveCount", { count: aliveCount })}
                  </span>
                )}
                {isStreakMode && !isHost && me && !me.eliminated && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/25 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-300">
                    <StreakFlame />
                    {t("liveGameV2.streakBadge", { count: me.streak, multiplier: nextStreakMultiplier(me.streak) })}
                  </span>
                )}
                {isRiskMode && !isHost && me && (
                  <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200">
                    {t("liveGameV2.bank", { points: me.score })}
                  </span>
                )}
                {isTeamBattle && !isHost && me?.team && (
                  <span className={`rounded-full border px-4 py-2 text-sm font-black uppercase tracking-wide ${TEAM_META[me.team].chip}`}>
                    {t(TEAM_META[me.team].labelKey)}
                  </span>
                )}
              </span>
              <span className={`rounded-2xl px-4 py-2 font-mono text-xl font-black ${secondsLeft > 5 ? "bg-blue-400/15 text-blue-100" : secondsLeft > 0 ? "bg-amber-400/20 text-amber-100" : "bg-red-400/20 text-red-100"}`} aria-live="polite">
                {secondsLeft > 0 ? t("liveGameV2.timeRemaining", { seconds: secondsLeft }) : t("liveGameV2.timeExpired")}
              </span>
            </div>

            {!isHost && me?.eliminated && (
              <p className="mb-5 rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
                {t("liveGameV2.eliminatedBanner")}
                {me.practiceTotal > 0 && (
                  <span className="ms-2 font-mono font-bold">
                    {t("liveGameV2.practiceScore", { correct: me.practiceCorrect, total: me.practiceTotal })}
                  </span>
                )}
              </p>
            )}

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 sm:p-8">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
                {isHost ? t("liveGameV2.hostQuestionHint") : t("liveGameV2.chooseAnswer")}
              </p>
              <h1 className="mx-auto mb-8 max-w-3xl break-words text-center text-3xl font-black leading-tight sm:text-5xl">{question.prompt}</h1>

              {isRiskMode && !isHost && me && !viewerAnswer && (
                <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-amber-300/25 bg-amber-400/10 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="live-risk-bet" className="text-sm font-bold text-amber-100">
                      {t("liveGameV2.betLabel")}
                    </label>
                    <span className="font-mono text-lg font-black text-amber-200">
                      {t("liveGameV2.betAmount", { points: bet })}
                    </span>
                  </div>
                  <input
                    id="live-risk-bet"
                    type="range"
                    min={0}
                    max={me.score}
                    step={me.score >= 200 ? 50 : 10}
                    value={Math.min(bet, me.score)}
                    onChange={(event) => setBet(Number(event.target.value))}
                    disabled={action !== null || secondsLeft <= 0}
                    className="mt-3 w-full cursor-pointer accent-amber-400 disabled:cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs leading-5 text-amber-100/80">{t("liveGameV2.betHint")}</p>
                </div>
              )}

              {isTypedMode ? (
                isHost ? null : (
                  <form
                    className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = typedAnswer.trim();
                      if (!value) return;
                      onAnswer(value, isRiskMode ? Math.min(bet, me?.score ?? 0) : undefined);
                    }}
                  >
                    <input
                      type="text"
                      value={typedAnswer}
                      onChange={(event) => setTypedAnswer(event.target.value)}
                      placeholder={t("liveGameV2.typedPlaceholder")}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={action !== null || viewerAnswer !== null || secondsLeft <= 0 || connection !== "connected"}
                      className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-slate-950/50 px-5 py-4 text-lg font-bold text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={action !== null || viewerAnswer !== null || secondsLeft <= 0 || connection !== "connected" || typedAnswer.trim().length === 0}
                      className="rounded-2xl bg-blue-500 px-6 py-4 font-black text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      {t("liveGameV2.typedSubmit")}
                    </button>
                  </form>
                )
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, index) => {
                    const selected = viewerAnswer?.answer === option;
                    const base = [
                      "border-blue-300/25 bg-blue-500/15 hover:bg-blue-500/25",
                      "border-violet-300/25 bg-violet-500/15 hover:bg-violet-500/25",
                      "border-cyan-300/25 bg-cyan-500/15 hover:bg-cyan-500/25",
                      "border-amber-300/25 bg-amber-500/15 hover:bg-amber-500/25",
                    ][index % 4];
                    if (isHost) {
                      return <div key={`${index}-${option}`} className={`min-h-20 rounded-2xl border p-4 text-center text-lg font-bold ${base}`}>{option}</div>;
                    }
                    return (
                      <button key={`${index}-${option}`} type="button" onClick={() => onAnswer(option, isRiskMode ? Math.min(bet, me?.score ?? 0) : undefined)} disabled={action !== null || viewerAnswer !== null || secondsLeft <= 0 || connection !== "connected"} aria-pressed={selected} className={`min-h-20 rounded-2xl border p-4 text-center text-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed ${selected ? "ring-2 ring-white bg-white/20" : base} ${viewerAnswer && !selected ? "opacity-45" : "cursor-pointer"}`}>
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
              {isHost ? (
                <p className="text-sm font-bold text-slate-300">{t("liveGameV2.answersProgress", { answered: question.answeredCount, players: session.participants.length })}</p>
              ) : (
                <p className="text-sm font-bold text-slate-300" aria-live="polite">
                  {viewerAnswer ? t("liveGameV2.answerLocked") : t("liveGameV2.chooseAnswer")}
                </p>
              )}
              {isHost && (
                <button type="button" onClick={onAdvance} disabled={action !== null || connection !== "connected"} className="rounded-xl bg-cyan-400 px-5 py-2.5 font-black text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                  {action === "advance" ? t("liveGameV2.showingResults") : t("liveGameV2.showResults")}
                </button>
              )}
            </div>
          </section>
        )}

        {session.status === "REVEAL" && question && (
          <section className="mx-auto grid max-w-5xl gap-6 py-7 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-7 sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">{t("liveGameV2.correctAnswer")}</p>
              <h1 className="mt-4 break-words text-4xl font-black text-white sm:text-6xl">{question.correctAnswer}</h1>
              <p className="mt-3 break-words text-xl font-bold text-emerald-100/70">{question.prompt}</p>

              {!isHost && viewerAnswer && (
                <div className={`mt-8 rounded-2xl border p-5 ${viewerAnswer.isCorrect ? "border-emerald-300/30 bg-emerald-300/10" : "border-amber-300/30 bg-amber-300/10"}`}>
                  <p className="text-xl font-black">{viewerAnswer.isCorrect ? t("liveGameV2.correct") : t("liveGameV2.incorrect")}</p>
                  <p className="mt-1 break-words text-sm text-slate-200">{t("liveGameV2.yourAnswer", { answer: viewerAnswer.answer })}</p>
                  <p className={`mt-3 font-mono text-lg font-black ${viewerAnswer.points < 0 ? "text-red-300" : "text-cyan-200"}`}>
                    {viewerAnswer.points < 0
                      ? t("liveGameV2.pointsLost", { points: Math.abs(viewerAnswer.points) })
                      : t("liveGameV2.pointsEarned", { points: viewerAnswer.points })}
                  </p>
                </div>
              )}
              {!isHost && !viewerAnswer && (
                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-sm text-slate-300">{t("liveGameV2.timeExpired")}</div>
              )}

              {isHost && (
                <button type="button" onClick={onAdvance} disabled={action !== null || connection !== "connected"} className="mt-8 rounded-2xl bg-emerald-300 px-6 py-3 font-black text-emerald-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                  {action === "advance" ? t("liveGameV2.loadingNext") : t("liveGameV2.nextQuestion")}
                </button>
              )}
            </div>
            <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="mb-4 text-xl font-black">
                {isTeamBattle ? t("liveGameV2.teamScoreboard") : t("liveGameV2.scoreboard")}
              </h2>
              {isTeamBattle && <TeamStandingsPanel session={session} />}
              <Scoreboard session={session} />
            </aside>
          </section>
        )}

        {session.status === "FINISHED" && (
          <section className="mx-auto max-w-4xl py-10 text-center">
            <ConfettiBurst />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">{t("liveGameV2.finalResults")}</p>
            <h1 className="mt-4 text-4xl font-black sm:text-6xl">
              {isTeamBattle
                ? (() => {
                    const standings = computeTeamStandings(session.participants);
                    return standings[0] && standings[1] && standings[0].average === standings[1].average
                      ? t("liveGameV2.teamDraw")
                      : t("liveGameV2.teamWinsName", { team: t(TEAM_META[standings[0]!.team].labelKey) });
                  })()
                : session.participants[0]
                  ? t("liveGameV2.winnerName", { name: session.participants[0].nickname })
                  : t("liveGameV2.noWinner")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">{t("liveGameV2.finalHint")}</p>

            <div className="relative mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-start sm:p-8">
              <h2 className="mb-5 text-xl font-black">{t("liveGameV2.finalResults")}</h2>
              {isTeamBattle && <TeamStandingsPanel session={session} />}
              <ResultsTable session={session} />
              {isHost && resultsSaved && (
                <p
                  role={resultsSaved === "error" ? "alert" : undefined}
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${resultsSaved === "error" ? "border-red-300/25 bg-red-500/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}
                >
                  {resultsSaved === "saving" && t("liveGameV2.resultsSaving")}
                  {resultsSaved === "saved" && t("liveGameV2.resultsSaved")}
                  {resultsSaved === "error" && t("liveGameV2.resultsSaveFailed")}
                </p>
              )}
            </div>
          </section>
        )}

        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="live-confirm-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
            onClick={() => setConfirming(null)}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-7 shadow-2xl shadow-black/50"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-300">{t("liveGameV2.endGame")}</p>
              <h2 id="live-confirm-title" className="mt-3 text-2xl font-black text-white">{t("liveGameV2.endConfirm")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{t("liveGameV2.endConfirmHint")}</p>
              <div className="mt-7 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirming(null)}
                  className="rounded-2xl border border-white/15 px-5 py-2.5 font-bold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  {t("liveGameV2.stay")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const kind = confirming;
                    setConfirming(null);
                    if (kind === "finish") onFinish();
                    else onLeave();
                  }}
                  className="rounded-2xl bg-red-500 px-5 py-2.5 font-black text-white transition hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 cursor-pointer"
                >
                  {t("liveGameV2.endGame")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
