"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";

interface GameSummary {
  id: number;
  roomCode: string;
  modeId: string | null;
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
  eliminated: boolean;
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

export default function LiveGameHistoryPanel() {
  const { t } = useI18n();
  const router = useRouter();

  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        throw new Error(body.error || t("liveHistory.loadFailed"));
      }
      const body: ListResponse = await response.json();
      setData(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("liveHistory.loadFailed")
      );
    } finally {
      setLoading(false);
    }
  }, [page, router, t]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (details[id]) return;

    setDetailLoading(true);
    try {
      const response = await fetch(`/api/live-game/results/${id}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("liveHistory.detailFailed"));
      }
      const body: { game: GameDetail } = await response.json();
      setDetails((prev) => ({ ...prev, [id]: body.game }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("liveHistory.detailFailed")
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const totalGames = data?.total ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t("liveHistory.title")}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-1">
          {totalGames === 1
            ? t("liveHistory.gamesHostedOne")
            : t("liveHistory.gamesHosted", { count: totalGames })}
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 py-12 text-center">
          {t("common.loading")}
        </p>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 py-12 text-center">
          {t("liveHistory.noGames")}
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
                        {game.setName ||
                          t("liveHistory.roomCode", { code: game.roomCode })}
                        {game.modeId && (
                          <span className="ml-2 inline-block rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-300 align-middle">
                            {game.modeId.replace(/_/g, " ")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(game.endedAt)} · {game.totalPlayers}{" "}
                        {game.totalPlayers === 1
                          ? t("liveHistory.player")
                          : t("liveHistory.playersLabel")}
                        {game.winnerName
                          ? ` · ${t("liveHistory.winner", { name: game.winnerName })}`
                          : ""}
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
                          {t("liveHistory.loadingDetail")}
                        </p>
                      ) : detail ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400">
                              <th className="py-1 pr-2">
                                {t("liveHistory.playerCol")}
                              </th>
                              <th className="py-1 px-2">
                                {t("liveHistory.scoreCol")}
                              </th>
                              <th className="py-1 px-2">
                                {t("liveHistory.correctCol")}
                              </th>
                              <th className="py-1 px-2">
                                {t("liveHistory.accuracyCol")}
                              </th>
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
                                      {t("liveHistory.winnerBadge")}
                                    </span>
                                  )}
                                  {p.eliminated && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                                      {t("liveGameV2.eliminatedTag")}
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
                          {t("liveHistory.noDetail")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("liveHistory.prev")}
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("liveHistory.page", {
                  page: data.page,
                  total: data.totalPages,
                })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("liveHistory.next")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
