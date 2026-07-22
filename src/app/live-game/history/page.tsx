"use client";

import Link from "next/link";
import LiveGameHistoryPanel from "@/components/LiveGameHistoryPanel";
import { useI18n } from "@/i18n/I18nProvider";

// Standalone live game history page — same visual world as the live hub,
// intentionally separate from the dashboard.
export default function LiveGameHistoryPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -start-32 -top-32 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -end-24 top-1/3 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/live-game" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer">
            ← {t("liveGameV2.backToHub")}
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer">
            {t("liveGameV2.backDashboard")}
          </Link>
        </nav>

        <header className="py-10 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.32em] text-cyan-300">
            {t("liveGameV2.eyebrow")}
          </p>
          <h1 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
            {t("liveGameV2.history")}
          </h1>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 sm:p-6">
          <LiveGameHistoryPanel />
        </section>
      </div>
    </main>
  );
}
