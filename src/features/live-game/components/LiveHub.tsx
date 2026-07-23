"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

interface LiveHubProps {
  joinOnly: boolean;
  mainAppUrl: string | null;
  roomCode: string;
  nickname: string;
  joining: boolean;
  error: string | null;
  onRoomCodeChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onJoin: () => void;
  onCreate: () => void;
}

function ModeIcon({ mode }: { mode: "classic" | "streak" | "survival" | "team" | "risk" }) {
  if (mode === "team") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-8 w-8">
        <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="32" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M6 40c0-6 4.5-10 10-10s10 4 10 10M22 40c0-6 4.5-10 10-10s10 4 10 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      </svg>
    );
  }
  if (mode === "risk") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-8 w-8">
        <rect x="9" y="9" width="30" height="30" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="18" cy="18" r="2.6" fill="currentColor" />
        <circle cx="30" cy="18" r="2.6" fill="currentColor" />
        <circle cx="24" cy="24" r="2.6" fill="currentColor" />
        <circle cx="18" cy="30" r="2.6" fill="currentColor" />
        <circle cx="30" cy="30" r="2.6" fill="currentColor" />
      </svg>
    );
  }
  if (mode === "streak") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-8 w-8">
        <path d="M24 6c2.4 8.4-7.2 12-7.2 20.8a9.2 9.2 0 0 0 18.4 0C35.2 19.2 26.8 16.8 24 6Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="4" />
        <path d="M24 39a5 5 0 0 1-5-5c0-3.4 3-5 5-8 1.6 3 4.9 4.6 4.9 8a5 5 0 0 1-4.9 5Z" fill="currentColor" />
      </svg>
    );
  }
  if (mode === "survival") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48" className="h-8 w-8">
        <path d="M24 5 40 11v12c0 9.6-6.4 16.8-16 20-9.6-3.2-16-10.4-16-20V11Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="4" />
        <path d="m17 24 5 5 9-10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-8 w-8">
      <path d="M24 7 29 18l12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="3.5" />
    </svg>
  );
}

export default function LiveHub({
  joinOnly,
  mainAppUrl,
  roomCode,
  nickname,
  joining,
  error,
  onRoomCodeChange,
  onNicknameChange,
  onJoin,
  onCreate,
}: LiveHubProps) {
  const { t } = useI18n();

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -start-32 -top-32 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -end-24 top-1/3 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute bottom-0 start-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          {joinOnly ? (
            mainAppUrl ? (
              <a href={mainAppUrl} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer">
                {t("liveGame.backFullApp")}
              </a>
            ) : <span />
          ) : (
            <Link href="/dashboard" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer">
              {t("liveGameV2.backDashboard")}
            </Link>
          )}
          {!joinOnly && (
            <Link href="/live-game/history" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer">
              {t("liveGameV2.history")}
            </Link>
          )}
        </nav>

        <header className="mx-auto max-w-3xl py-12 text-center sm:py-16">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.32em] text-cyan-300">
            {t("liveGameV2.eyebrow")}
          </p>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl">
            {t("liveGameV2.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            {t("liveGameV2.subtitle")}
          </p>
        </header>

        <section className={`mx-auto grid max-w-4xl gap-5 ${joinOnly ? "grid-cols-1 max-w-xl" : "md:grid-cols-2"}`}>
          {!joinOnly && (
            <button type="button" onClick={onCreate} className="group rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-500/20 to-violet-500/10 p-7 text-start shadow-2xl shadow-blue-950/30 transition hover:-translate-y-1 hover:border-blue-300/60 hover:bg-blue-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer">
              <span className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/30 transition group-hover:scale-105">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <h2 className="text-2xl font-bold">{t("liveGameV2.createGame")}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{t("liveGameV2.createGameDesc")}</p>
            </button>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onJoin();
            }}
            className="rounded-3xl border border-white/15 bg-white/[0.07] p-7 shadow-2xl shadow-black/20 backdrop-blur-xl"
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6M15 12H3M15 5h3a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-3" />
                </svg>
              </span>
              <div>
                <h2 className="text-2xl font-bold">{t("liveGameV2.joinGame")}</h2>
                <p className="mt-1 text-sm text-slate-300">{t("liveGameV2.joinGameDesc")}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="live-room-code" className="mb-1.5 block text-sm font-semibold text-slate-200">
                  {t("liveGameV2.roomCode")}
                </label>
                <input id="live-room-code" value={roomCode} onChange={(event) => onRoomCodeChange(event.target.value)} maxLength={8} autoComplete="off" spellCheck={false} placeholder={t("liveGameV2.roomCodePlaceholder")} className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-center font-mono text-xl font-bold uppercase tracking-[0.24em] text-white placeholder:text-slate-600 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              </div>
              <div>
                <label htmlFor="live-nickname" className="mb-1.5 block text-sm font-semibold text-slate-200">
                  {t("liveGameV2.nickname")}
                </label>
                <input id="live-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value.slice(0, 40))} maxLength={40} autoComplete="nickname" placeholder={t("liveGameV2.nicknamePlaceholder")} className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              </div>
              <button type="submit" disabled={joining || roomCode.length < 4 || nickname.trim().length === 0} className="w-full rounded-2xl bg-violet-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                {joining ? t("liveGameV2.joining") : t("liveGameV2.join")}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <p role="alert" className="mx-auto mt-5 max-w-4xl rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        {!joinOnly && (
          <section className="py-16" aria-labelledby="live-modes-title">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="live-modes-title" className="text-2xl font-bold sm:text-3xl">{t("liveGameV2.browseModes")}</h2>
                <p className="mt-2 text-sm text-slate-400">{t("liveGameV2.modesHint")}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {([
                { id: "classic", title: "liveGameV2.classicTitle", desc: "liveGameV2.classicDesc", pace: "liveGameV2.synchronized", available: true, color: "text-amber-300 bg-amber-400/10 border-amber-300/30" },
                { id: "streak", title: "liveGameV2.streakTitle", desc: "liveGameV2.streakDesc", pace: "liveGameV2.synchronized", available: true, color: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20" },
                { id: "survival", title: "liveGameV2.survivalTitle", desc: "liveGameV2.survivalDesc", pace: "liveGameV2.synchronized", available: true, color: "text-cyan-300 bg-cyan-400/10 border-cyan-300/20" },
                { id: "team", title: "liveGameV2.teamTitle", desc: "liveGameV2.teamDesc", pace: "liveGameV2.synchronized", available: true, color: "text-rose-300 bg-rose-400/10 border-rose-300/20" },
                { id: "risk", title: "liveGameV2.riskTitle", desc: "liveGameV2.riskDesc", pace: "liveGameV2.synchronized", available: true, color: "text-violet-300 bg-violet-400/10 border-violet-300/20" },
              ] as const).map((mode) => (
                <article key={mode.id} className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
                  <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${mode.color}`}>
                    <ModeIcon mode={mode.id} />
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${mode.available ? "bg-blue-500/20 text-blue-200" : "bg-white/10 text-slate-400"}`}>
                      {mode.available ? t("liveGameV2.availableNow") : t("liveGameV2.comingSoon")}
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">{t(mode.pace)}</span>
                  </div>
                  <h3 className="text-xl font-bold">{t(mode.title)}</h3>
                  <p className="mt-2 min-h-20 text-sm leading-6 text-slate-400">{t(mode.desc)}</p>
                  <p className="mt-4 text-xs font-medium text-slate-500">{t("liveGameV2.recommendedPlayers", { min: 2, max: 100 })}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
