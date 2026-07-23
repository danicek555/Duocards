"use client";

// Interní administrátorský přehled — záměrně bez i18n (pouze česky),
// aby se nedotýkal sdílených překladových souborů.

import { useEffect, useState } from "react";
import AdminNav from "./AdminNav";

interface Overview {
  generatedAt: string;
  users: { total: number; verified: number; newToday: number; new7d: number };
  content: { sets: number; publicSets: number; aiSets: number; words: number };
  coins: {
    inPlay: number;
    spent30d: number;
    earned30d: number;
    aiGenerationsToday: number;
    aiGenerations7d: number;
  };
  study: { sessions7d: number; reviews7d: number; accuracy7d: number | null };
  live: {
    gamesTotal: number;
    games30d: number;
    playersTotal: number;
    activeSessions: number;
    topModes30d: { modeId: string; count: number }[];
  };
  latestUsers: {
    id: number;
    nickname: string;
    email: string;
    locale: string;
    emailVerified: boolean;
    coins: number;
    createdAt: string;
  }[];
  latestGames: {
    id: number;
    roomCode: string;
    modeId: string | null;
    setName: string | null;
    totalPlayers: number;
    winnerName: string | null;
    endedAt: string;
  }[];
  series: {
    registrations14d: { day: string; count: number }[];
    reviews14d: { day: string; count: number }[];
  };
}

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Bars({ title, data }: { title: string; data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className="flex h-28 items-end gap-1.5">
        {data.map((d) => (
          <div key={d.day} className="group relative flex-1">
            <div
              className="w-full rounded-t bg-indigo-400/80 transition group-hover:bg-indigo-300"
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block">
              {d.day.slice(5)}: {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setData((await response.json()) as Overview);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -start-32 -top-32 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -end-24 top-1/3 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNav />

        {error && (
          <p role="alert" className="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Přehled se nepodařilo načíst ({error}).
          </p>
        )}
        {!data && !error && <p className="animate-pulse text-slate-300">Načítám přehled…</p>}

        {data && (
          <>
            <Section title="Uživatelé">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Celkem" value={data.users.total} />
                <Tile label="Ověřený e-mail" value={data.users.verified} />
                <Tile label="Nových za 24 h" value={data.users.newToday} />
                <Tile label="Nových za 7 dní" value={data.users.new7d} />
              </div>
            </Section>

            <Section title="Obsah">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Balíčky" value={data.content.sets} />
                <Tile label="Veřejné balíčky" value={data.content.publicSets} />
                <Tile label="AI balíčky" value={data.content.aiSets} />
                <Tile label="Slovíčka" value={data.content.words} />
              </div>
            </Section>

            <Section title="Mince a AI">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Mincí v oběhu" value={data.coins.inPlay} />
                <Tile label="Utraceno / 30 dní" value={data.coins.spent30d} />
                <Tile label="Získáno / 30 dní" value={data.coins.earned30d} />
                <Tile label="AI generování / 7 dní" value={data.coins.aiGenerations7d} hint={`dnes: ${data.coins.aiGenerationsToday}`} />
              </div>
            </Section>

            <Section title="Učení a živé hry">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Study sessions / 7 dní" value={data.study.sessions7d} />
                <Tile
                  label="Opakování / 7 dní"
                  value={data.study.reviews7d}
                  hint={data.study.accuracy7d === null ? undefined : `úspěšnost ${data.study.accuracy7d} %`}
                />
                <Tile label="Živých her celkem" value={data.live.gamesTotal} hint={`za 30 dní: ${data.live.games30d}`} />
                <Tile label="Aktivní místnosti" value={data.live.activeSessions} hint={`hráčů celkem: ${data.live.playersTotal}`} />
              </div>
              {data.live.topModes30d.length > 0 && (
                <p className="mt-3 text-sm text-slate-400">
                  Nejhranější módy (30 dní):{" "}
                  {data.live.topModes30d.map((m) => `${m.modeId.replace(/_/g, " ")} (${m.count})`).join(" · ")}
                </p>
              )}
            </Section>

            <Section title="Trendy — posledních 14 dní">
              <div className="grid gap-4 lg:grid-cols-2">
                <Bars title="Registrace" data={data.series.registrations14d} />
                <Bars title="Opakování kartiček" data={data.series.reviews14d} />
              </div>
            </Section>

            <Section title="Poslední registrace">
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
                <table className="w-full min-w-130 text-sm">
                  <thead>
                    <tr className="text-start text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 text-start">Přezdívka</th>
                      <th className="px-4 py-3 text-start">E-mail</th>
                      <th className="px-4 py-3">Jazyk</th>
                      <th className="px-4 py-3">Ověřen</th>
                      <th className="px-4 py-3 text-end">Mince</th>
                      <th className="px-4 py-3 text-end">Registrace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestUsers.map((user) => (
                      <tr key={user.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5 font-bold">{user.nickname}</td>
                        <td className="px-4 py-2.5 text-slate-300">{user.email}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs uppercase text-slate-300">{user.locale}</td>
                        <td className="px-4 py-2.5 text-center">{user.emailVerified ? "✓" : "—"}</td>
                        <td className="px-4 py-2.5 text-end font-mono">{user.coins}</td>
                        <td className="px-4 py-2.5 text-end text-slate-400">{new Date(user.createdAt).toLocaleString("cs-CZ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Poslední živé hry">
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
                <table className="w-full min-w-130 text-sm">
                  <thead>
                    <tr className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 text-start">Kód</th>
                      <th className="px-4 py-3 text-start">Mód</th>
                      <th className="px-4 py-3 text-start">Balíček</th>
                      <th className="px-4 py-3 text-end">Hráčů</th>
                      <th className="px-4 py-3 text-start">Vítěz</th>
                      <th className="px-4 py-3 text-end">Konec</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestGames.map((game) => (
                      <tr key={game.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5 font-mono font-bold">{game.roomCode}</td>
                        <td className="px-4 py-2.5 text-slate-300">{game.modeId ? game.modeId.replace(/_/g, " ") : "—"}</td>
                        <td className="px-4 py-2.5 text-slate-300">{game.setName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-end font-mono">{game.totalPlayers}</td>
                        <td className="px-4 py-2.5">{game.winnerName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-end text-slate-400">{new Date(game.endedAt).toLocaleString("cs-CZ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <p className="mt-10 text-xs text-slate-500">
              Vygenerováno {new Date(data.generatedAt).toLocaleString("cs-CZ")} · pouze pro čtení
            </p>
          </>
        )}
      </div>
    </main>
  );
}
