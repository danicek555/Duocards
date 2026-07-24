"use client";

// Interní správa — provozní metriky (jen čtení).

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";

interface SystemData {
  database: {
    tables: { table: string; bytes: number }[];
    media: {
      images: { count: number; bytes: number };
      audio: { count: number; bytes: number };
    };
  };
  backend: { url: string; healthy: boolean; latencyMs: number | null };
  auditTrail: {
    adminUserId: number;
    action: string;
    detail: string | null;
    createdAt: string;
  }[];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} kB`;
  return `${bytes} B`;
}

interface MigrationProgress {
  running: boolean;
  migrated: number;
  remaining: number | null;
  savedBytes: number;
  error: string | null;
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migration, setMigration] = useState<MigrationProgress>({
    running: false,
    migrated: 0,
    remaining: null,
    savedBytes: 0,
    error: null,
  });

  const runMigration = async () => {
    setMigration({ running: true, migrated: 0, remaining: null, savedBytes: 0, error: null });
    let migrated = 0;
    let savedBytes = 0;
    let afterImageId = 0;
    let afterAudioId = 0;
    try {
      // Dávkuje se po malých krocích, dokud v DB zbývá base64 obsah.
      for (let round = 0; round < 1000; round += 1) {
        const response = await fetch("/api/admin/migrate-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ afterImageId, afterAudioId }),
        });
        const text = await response.text();
        let payload: {
          error?: string;
          migratedImages: number;
          migratedAudio: number;
          savedBytes: number;
          failed: { table: string; id: number; reason: string }[];
          afterImageId: number;
          afterAudioId: number;
          remainingImages: number;
          remainingAudio: number;
        };
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(`HTTP ${response.status}: ${text.slice(0, 160) || "prázdná odpověď (timeout funkce?)"}`);
        }
        if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
        migrated += payload.migratedImages + payload.migratedAudio;
        savedBytes += payload.savedBytes;
        afterImageId = payload.afterImageId;
        afterAudioId = payload.afterAudioId;
        const remaining = payload.remainingImages + payload.remainingAudio;
        const stalled =
          payload.migratedImages + payload.migratedAudio === 0 &&
          payload.failed.length === 0;
        const failNote = payload.failed.length > 0
          ? `přeskočeno ${payload.failed.length}, poslední důvod: ${payload.failed[payload.failed.length - 1].reason}`
          : null;
        setMigration({ running: remaining > 0 && !stalled, migrated, remaining, savedBytes, error: failNote });
        if (remaining === 0 || stalled) break;
      }
    } catch (err) {
      setMigration((current) => ({ ...current, running: false, error: (err as Error).message }));
    }
  };

  useEffect(() => {
    fetch("/api/admin/system")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setData((await response.json()) as SystemData);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const maxTableBytes = data
    ? Math.max(1, ...data.database.tables.map((row) => row.bytes))
    : 1;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNav />

        {error && (
          <p role="alert" className="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Načtení selhalo ({error}).
          </p>
        )}
        {!data && !error && <p className="animate-pulse text-slate-300">Načítám…</p>}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className={`rounded-2xl border p-5 ${data.backend.healthy ? "border-emerald-300/25 bg-emerald-400/10" : "border-red-300/25 bg-red-500/10"}`}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-300">Cloud Run backend</p>
                <p className="mt-2 text-2xl font-black">{data.backend.healthy ? "Běží" : "Nedostupný"}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {data.backend.latencyMs !== null ? `odezva ${data.backend.latencyMs} ms` : "health check selhal"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Obrázky v DB</p>
                <p className="mt-2 text-2xl font-black">{formatBytes(data.database.media.images.bytes)}</p>
                <p className="mt-1 text-xs text-slate-400">{data.database.media.images.count} souborů (base64)</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Audio v DB</p>
                <p className="mt-2 text-2xl font-black">{formatBytes(data.database.media.audio.bytes)}</p>
                <p className="mt-1 text-xs text-slate-400">{data.database.media.audio.count} souborů (base64)</p>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Migrace médií do Vercel Blob</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Přesune base64 obrázky (komprese na WebP 512 px) a audio z databáze do Blob úložiště. Bezpečné spouštět opakovaně.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runMigration()}
                  disabled={migration.running}
                  className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {migration.running ? "Migruji…" : "Spustit migraci"}
                </button>
              </div>
              {(migration.remaining !== null || migration.error) && (
                <p className={`mt-3 text-sm ${migration.error ? "text-red-200" : "text-slate-300"}`} aria-live="polite">
                  {migration.error
                    ? `Chyba: ${migration.error}`
                    : `Zmigrováno ${migration.migrated} souborů, ušetřeno ${formatBytes(Math.max(0, migration.savedBytes))}, zbývá ${migration.remaining}.`}
                </p>
              )}
            </section>

            <h3 className="mb-3 mt-10 text-xl font-black">Největší tabulky</h3>
            <div className="space-y-2">
              {data.database.tables.map((row) => (
                <div key={row.table} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 truncate font-mono text-xs text-slate-300">{row.table}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-white/[0.06]">
                    <div className="h-full rounded bg-indigo-400/70" style={{ width: `${Math.max(2, (row.bytes / maxTableBytes) * 100)}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-end font-mono text-xs text-slate-300">{formatBytes(row.bytes)}</span>
                </div>
              ))}
            </div>

            <h3 className="mb-3 mt-10 text-xl font-black">Poslední admin akce (audit)</h3>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full min-w-105 text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 text-start">Akce</th>
                    <th className="px-4 py-3 text-start">Detail</th>
                    <th className="px-4 py-3 text-end">Admin</th>
                    <th className="px-4 py-3 text-end">Kdy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.auditTrail.map((entry, index) => (
                    <tr key={index} className="border-t border-white/5">
                      <td className="px-4 py-2.5 font-mono text-xs">{entry.action}</td>
                      <td className="px-4 py-2.5 text-slate-300">{entry.detail ?? "—"}</td>
                      <td className="px-4 py-2.5 text-end font-mono">#{entry.adminUserId}</td>
                      <td className="px-4 py-2.5 text-end text-slate-400">{new Date(entry.createdAt).toLocaleString("cs-CZ")}</td>
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
