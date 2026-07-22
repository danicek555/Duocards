"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { LiveGameSessionSnapshot } from "../contracts";
import type { LiveGameClientRole } from "../sessionStorage";

export type LiveConnectionState = "connected" | "reconnecting" | "offline";
export type LiveAction = "start" | "advance" | "answer" | "finish" | null;

interface LiveSessionViewProps {
  session: LiveGameSessionSnapshot;
  role: LiveGameClientRole;
  connection: LiveConnectionState;
  action: LiveAction;
  copied: boolean;
  error: string | null;
  onCopyInvite: () => void;
  onStart: () => void;
  onAdvance: () => void;
  onAnswer: (answer: string) => void;
  onFinish: () => void;
  onLeave: () => void;
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
          <li key={participant.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${index === 0 ? "bg-amber-400 text-amber-950" : "bg-white/10 text-slate-300"}`}>
              {index + 1}
            </span>
            <span className="min-w-0 break-words font-bold text-white">{participant.nickname}</span>
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
  onCopyInvite,
  onStart,
  onAdvance,
  onAnswer,
  onFinish,
  onLeave,
}: LiveSessionViewProps) {
  const { t } = useI18n();
  const [clock, setClock] = useState(() => Date.now());
  const isHost = role === "host";
  const question = session.currentQuestion;
  const viewerAnswer = session.viewer?.currentAnswer ?? null;

  useEffect(() => {
    if (session.status !== "QUESTION") return;
    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [session.status, question?.id]);

  const secondsLeft = useMemo(() => {
    if (!question?.locksAt) return 0;
    return Math.max(0, Math.ceil((new Date(question.locksAt).getTime() - clock) / 1_000));
  }, [clock, question?.locksAt]);

  const leaveButton = (
    <button type="button" onClick={onLeave} disabled={action !== null} className="rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
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
            {isHost && session.status !== "FINISHED" && session.status !== "LOBBY" && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t("liveGameV2.endConfirm"))) onFinish();
                }}
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
              <div className="my-8 rounded-3xl border border-white/15 bg-slate-950/55 px-5 py-7 text-center font-mono text-4xl font-black tracking-[0.22em] text-white sm:text-6xl">
                {session.roomCode}
              </div>
              {isHost ? (
                <>
                  <button type="button" onClick={onCopyInvite} className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-bold transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 cursor-pointer">
                    {copied ? t("liveGameV2.copied") : t("liveGameV2.copyLink")}
                  </button>
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
              {session.participants.length === 0 ? (
                <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center text-sm leading-6 text-slate-400">{t("liveGameV2.noPlayers")}</p>
              ) : (
                <ul className="flex-1 space-y-2">
                  {session.participants.map((participant, index) => (
                    <li key={participant.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-400/15 text-sm font-black text-blue-200">{index + 1}</span>
                      <span className="min-w-0 break-words font-bold">{participant.nickname}</span>
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

        {session.status === "QUESTION" && question && (
          <section className="mx-auto max-w-5xl py-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-slate-200">
                {t("liveGameV2.questionProgress", { current: question.sequence, total: session.totalQuestions })}
              </span>
              <span className={`rounded-2xl px-4 py-2 font-mono text-xl font-black ${secondsLeft > 5 ? "bg-blue-400/15 text-blue-100" : secondsLeft > 0 ? "bg-amber-400/20 text-amber-100" : "bg-red-400/20 text-red-100"}`} aria-live="polite">
                {secondsLeft > 0 ? t("liveGameV2.timeRemaining", { seconds: secondsLeft }) : t("liveGameV2.timeExpired")}
              </span>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 sm:p-8">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
                {isHost ? t("liveGameV2.hostQuestionHint") : t("liveGameV2.chooseAnswer")}
              </p>
              <h1 className="mx-auto mb-8 max-w-3xl break-words text-center text-3xl font-black leading-tight sm:text-5xl">{question.prompt}</h1>
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
                    <button key={`${index}-${option}`} type="button" onClick={() => onAnswer(option)} disabled={action !== null || viewerAnswer !== null || secondsLeft <= 0 || connection !== "connected"} aria-pressed={selected} className={`min-h-20 rounded-2xl border p-4 text-center text-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed ${selected ? "ring-2 ring-white bg-white/20" : base} ${viewerAnswer && !selected ? "opacity-45" : "cursor-pointer"}`}>
                      {option}
                    </button>
                  );
                })}
              </div>
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
                  <p className="mt-3 font-mono text-lg font-black text-cyan-200">{t("liveGameV2.pointsEarned", { points: viewerAnswer.points })}</p>
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
              <h2 className="mb-4 text-xl font-black">{t("liveGameV2.scoreboard")}</h2>
              <Scoreboard session={session} />
            </aside>
          </section>
        )}

        {session.status === "FINISHED" && (
          <section className="mx-auto max-w-4xl py-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">{t("liveGameV2.finalResults")}</p>
            <h1 className="mt-4 text-4xl font-black sm:text-6xl">
              {session.participants[0]
                ? t("liveGameV2.winnerName", { name: session.participants[0].nickname })
                : t("liveGameV2.noWinner")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">{t("liveGameV2.finalHint")}</p>

            <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-start sm:p-8">
              <h2 className="mb-5 text-xl font-black">{t("liveGameV2.scoreboard")}</h2>
              <Scoreboard session={session} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
