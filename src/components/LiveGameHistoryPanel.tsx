"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface GameSummary {
  id: number;
  roomCode: string;
  setName: string | null;
  totalPlayers: number;
  winnerName: string | null;
  startedAt: string | null;
  endedAt: string;
  createdAt: string;
}

interface GamePlayer {
  id: number;
  name: string;
  score: number;
  correct: number;
  total: number;
  isWinner: boolean;
  accuracy: number | null;
}

interface GameDetail extends GameSummary {
  players: GamePlayer[];
}

interface ListResponse {
  items: GameSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

/**
 * Embeddable live game history panel. Rendered inside the dashboard's right
 * content area so the dashboard sidebar stays visible on the left.
 */
export default function LiveGameHistoryPanel() {
  const router = useRouter();

  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Expanded game detail (lazy-loaded on first expand and cached).
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, GameDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/live-game/results?page=${page}`);
      if (response.status === 401) {
        router.push("/");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load live games");
      }
      const body: ListResponse = await response.json();
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live games");
    } finally {
      setLoading(false);
    }
  }, [page, router]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (details[id]) return; // cached

    setDetailLoading(true);
    try {
      const response = await fetch(`/api/live-game/results/${id}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load game detail");
      }
      const body: { game: GameDetail } = await response.json();
      setDetails((prev) => ({ ...prev, [id]: body.game }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const totalGames = data?.total ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Live Game History
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-1">
          {totalGames} {totalGames === 1 ? "game" : "games"} hosted.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 py-12 text-center">
          Loading...
        </p>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 py-12 text-center">
          No live games saved yet. Host a live game to see it here.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((game) => {
              const isExpanded = expandedId === game.id;
              const detail = details[game.id];
              return (
                <div
                  key={game.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => toggleExpand(game.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {game.setName || `Room ${game.roomCode}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(game.endedAt)} · {game.totalPlayers}{" "}
                        {game.totalPlayers === 1 ? "player" : "players"}
                        {game.winnerName ? ` · winner: ${game.winnerName}` : ""}
                      </p>
                    </div>
                    <span className="text-gray-400 text-sm ml-3">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                      {detailLoading && !detail ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Loading...
                        </p>
                      ) : detail ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400">
                              <th className="py-1 pr-2">Player</th>
                              <th className="py-1 px-2">Score</th>
                              <th className="py-1 px-2">Correct</th>
                              <th className="py-1 px-2">Accuracy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.players.map((p) => (
                              <tr
                                key={p.id}
                                className="border-t border-gray-100 dark:border-gray-700/50"
                              >
                                <td className="py-1 pr-2 text-gray-900 dark:text-white">
                                  {p.name}
                                  {p.isWinner && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                                      winner
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 px-2 text-gray-700 dark:text-gray-300">
                                  {p.score}
                                </td>
                                <td className="py-1 px-2 text-gray-700 dark:text-gray-300">
                                  {p.correct}/{p.total}
                                </td>
                                <td className="py-1 px-2 text-gray-700 dark:text-gray-300">
                                  {p.accuracy === null ? "-" : `${p.accuracy}%`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No detail available.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
