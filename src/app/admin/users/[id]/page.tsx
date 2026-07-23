"use client";

// Interní správa — detail účtu (jen čtení).

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "../../AdminNav";

interface UserDetail {
  user: {
    id: number;
    nickname: string;
    email: string;
    locale: string;
    emailVerified: boolean;
    coins: number;
    createdAt: string;
    updatedAt: string;
    lastDailyReward: string | null;
    role: string;
    hasGoogle: boolean;
    hasFacebook: boolean;
  };
  sets: {
    id: number;
    name: string;
    isPublic: boolean;
    isAIGenerated: boolean;
    publicCode: string | null;
    createdAt: string;
    _count: { words: number };
  }[];
  coinTransactions: {
    id: number;
    amount: number;
    balanceAfter: number;
    type: string;
    createdAt: string;
  }[];
  stats: {
    studySessions: number;
    studyReviews7d: number;
    liveGamesHosted: number;
  };
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-white">{value}</p>
    </div>
  );
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setData((await response.json()) as UserDetail);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNav />
        <p className="mb-6">
          <Link href="/admin/users" className="text-sm font-bold text-blue-300 hover:underline">← Zpět na uživatele</Link>
        </p>

        {error && (
          <p role="alert" className="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Načtení selhalo ({error}).
          </p>
        )}
        {!data && !error && <p className="animate-pulse text-slate-300">Načítám…</p>}

        {data && (
          <>
            <h2 className="mb-1 text-2xl font-black">
              {data.user.nickname}
              {data.user.role === "ADMIN" && (
                <span className="ms-2 rounded-full bg-violet-500/25 px-2 py-0.5 text-xs font-black uppercase text-violet-200 align-middle">admin</span>
              )}
            </h2>
            <p className="mb-6 text-slate-300">{data.user.email}</p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Mince" value={data.user.coins} />
              <Info label="Jazyk" value={data.user.locale.toUpperCase()} />
              <Info label="E-mail ověřen" value={data.user.emailVerified ? "ano" : "ne"} />
              <Info label="Registrace" value={new Date(data.user.createdAt).toLocaleDateString("cs-CZ")} />
              <Info label="Study sessions" value={data.stats.studySessions} />
              <Info label="Opakování / 7 dní" value={data.stats.studyReviews7d} />
              <Info label="Hostované hry" value={data.stats.liveGamesHosted} />
              <Info label="Přihlášení" value={[data.user.hasGoogle && "Google", data.user.hasFacebook && "Facebook", !data.user.hasGoogle && !data.user.hasFacebook && "e-mail"].filter(Boolean).join(" + ")} />
            </div>

            <h3 className="mb-3 mt-10 text-xl font-black">Balíčky ({data.sets.length})</h3>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full min-w-130 text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 text-start">Název</th>
                    <th className="px-4 py-3 text-end">Slovíček</th>
                    <th className="px-4 py-3">Veřejný</th>
                    <th className="px-4 py-3">AI</th>
                    <th className="px-4 py-3 text-end">Vytvořen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sets.map((set) => (
                    <tr key={set.id} className="border-t border-white/5">
                      <td className="px-4 py-2.5 font-bold">
                        {set.name}
                        {set.publicCode && <span className="ms-2 font-mono text-xs text-emerald-300">[{set.publicCode}]</span>}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono">{set._count.words}</td>
                      <td className="px-4 py-2.5 text-center">{set.isPublic ? "✓" : "—"}</td>
                      <td className="px-4 py-2.5 text-center">{set.isAIGenerated ? "✓" : "—"}</td>
                      <td className="px-4 py-2.5 text-end text-slate-400">{new Date(set.createdAt).toLocaleDateString("cs-CZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mb-3 mt-10 text-xl font-black">Poslední transakce mincí</h3>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full min-w-105 text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 text-start">Typ</th>
                    <th className="px-4 py-3 text-end">Částka</th>
                    <th className="px-4 py-3 text-end">Zůstatek</th>
                    <th className="px-4 py-3 text-end">Kdy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coinTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-white/5">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-300">{transaction.type}</td>
                      <td className={`px-4 py-2.5 text-end font-mono font-bold ${transaction.amount >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {transaction.amount >= 0 ? `+${transaction.amount}` : transaction.amount}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono">{transaction.balanceAfter}</td>
                      <td className="px-4 py-2.5 text-end text-slate-400">{new Date(transaction.createdAt).toLocaleString("cs-CZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
