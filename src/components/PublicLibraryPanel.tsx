"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PublicSet {
  id: number;
  name: string;
  fromLanguage: string | null;
  toLanguage: string | null;
  tags: string[];
  publicCode: string | null;
  isAIGenerated: boolean;
  createdAt: string;
  ownerNickname: string;
  wordCount: number;
  ownedByMe: boolean;
  alreadyAdded: boolean;
}

interface PublicSetsResponse {
  items: PublicSet[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Embeddable public catalog panel. Rendered inside the dashboard's right
 * content area so the dashboard sidebar stays visible on the left.
 */
export default function PublicLibraryPanel() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [tags, setTags] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PublicSetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Per-set state for the "add to my sets" action
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [joinedCodes, setJoinedCodes] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState("");

  const fetchSets = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (tags.trim()) params.set("tags", tags.trim());
    params.set("page", String(page));

    try {
      const response = await fetch(
        `/api/flashcard-sets/public?${params.toString()}`
      );

      if (response.status === 401) {
        router.push("/");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load public flashcard sets");
      }

      const body: PublicSetsResponse = await response.json();
      setData(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load public flashcard sets"
      );
    } finally {
      setLoading(false);
    }
  }, [query, tags, page, router]);

  // Debounce search/tag changes; reset to page 1 when filters change.
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSets();
    }, 300);
    return () => clearTimeout(timeout);
  }, [fetchSets]);

  const handleFilterChange = (setter: (value: string) => void) => {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  };

  const handleAdd = async (set: PublicSet) => {
    if (!set.publicCode) return;
    setActionError("");
    setJoiningId(set.id);

    try {
      const response = await fetch("/api/flashcard-sets/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: set.publicCode }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || "Failed to add flashcard set");
      }

      setJoinedCodes((prev) => new Set(prev).add(set.publicCode as string));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to add flashcard set"
      );
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Public Library
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-1">
          Browse public flashcard sets and add them to your account.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => handleFilterChange(setQuery)(e.target.value)}
          placeholder="Search by name..."
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="text"
          value={tags}
          onChange={(e) => handleFilterChange(setTags)(e.target.value)}
          placeholder="Filter by tags (comma-separated)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* Content */}
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
          No public flashcard sets found.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((set) => {
              const joinedNow = set.publicCode
                ? joinedCodes.has(set.publicCode)
                : false;
              const haveIt = set.ownedByMe || set.alreadyAdded || joinedNow;
              return (
                <div
                  key={set.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex flex-col"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {set.name}
                      </h3>
                      {haveIt && (
                        <span className="shrink-0 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                          {set.ownedByMe ? "Yours" : "You have this"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      by {set.ownerNickname} · {set.wordCount}{" "}
                      {set.wordCount === 1 ? "word" : "words"}
                    </p>
                    {(set.fromLanguage || set.toLanguage) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {set.fromLanguage ?? "?"} → {set.toLanguage ?? "?"}
                      </p>
                    )}
                    {set.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {set.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAdd(set)}
                    disabled={joiningId === set.id || haveIt || !set.publicCode}
                    className="mt-4 w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {set.ownedByMe
                      ? "Your set"
                      : haveIt
                      ? "Already added"
                      : joiningId === set.id
                      ? "Adding..."
                      : "Add to my sets"}
                  </button>
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
