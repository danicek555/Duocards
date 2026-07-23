"use client";

// Interní správa — seznam uživatelů s vyhledáváním a stránkováním (jen čtení).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "../AdminNav";

interface UserRow {
  id: number;
  nickname: string;
  email: string;
  locale: string;
  emailVerified: boolean;
  coins: number;
  createdAt: string;
  role: string;
  _count: { flashcardSets: number; words: number; liveGames: number };
}

interface UsersResponse {
  items: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search: string, pageNumber: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pageNumber) });
      if (search) params.set("query", search);
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as UsersResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(submittedQuery, page);
  }, [load, page, submittedQuery]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNav />

        <form
          className="mb-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSubmittedQuery(query.trim());
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat podle e-mailu nebo přezdívky…"
            className="w-full max-w-md rounded-xl border border-white/15 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
          />
          <button type="submit" className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-400">
            Hledat
          </button>
        </form>

        {error && (
          <p role="alert" className="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Načtení selhalo ({error}).
          </p>
        )}
        {loading && <p className="animate-pulse text-slate-300">Načítám…</p>}

        {data && !loading && (
          <>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 text-start">Uživatel</th>
                    <th className="px-4 py-3 text-start">E-mail</th>
                    <th className="px-4 py-3">Jazyk</th>
                    <th className="px-4 py-3 text-end">Balíčky</th>
                    <th className="px-4 py-3 text-end">Slovíčka</th>
                    <th className="px-4 py-3 text-end">Hry</th>
                    <th className="px-4 py-3 text-end">Mince</th>
                    <th className="px-4 py-3 text-end">Registrace</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user.id} className="border-t border-white/5 transition hover:bg-white/[0.04]">
                      <td className="px-4 py-2.5 font-bold">
                        <Link href={`/admin/users/${user.id}`} className="text-blue-300 hover:underline">
                          {user.nickname}
                        </Link>
                        {user.role === "ADMIN" && (
                          <span className="ms-2 rounded-full bg-violet-500/25 px-2 py-0.5 text-[10px] font-black uppercase text-violet-200">admin</span>
                        )}
                        {!user.emailVerified && (
                          <span className="ms-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-amber-200">neověřen</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{user.email}</td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs uppercase text-slate-300">{user.locale}</td>
                      <td className="px-4 py-2.5 text-end font-mono">{user._count.flashcardSets}</td>
                      <td className="px-4 py-2.5 text-end font-mono">{user._count.words}</td>
                      <td className="px-4 py-2.5 text-end font-mono">{user._count.liveGames}</td>
                      <td className="px-4 py-2.5 text-end font-mono">{user.coins}</td>
                      <td className="px-4 py-2.5 text-end text-slate-400">{new Date(user.createdAt).toLocaleDateString("cs-CZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>
                Celkem {data.total} účtů · strana {data.page}/{data.totalPages}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-xl border border-white/15 px-4 py-2 font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Předchozí
                </button>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-xl border border-white/15 px-4 py-2 font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Další →
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
