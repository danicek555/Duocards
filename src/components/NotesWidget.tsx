"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { isJoinOnlyLiveBrowser } from "@/lib/liveGameHost";
import { LANGUAGES, getLanguageLabel } from "@/lib/languages";

const MAX_LENGTH = 20000;
const AUTOSAVE_DELAY_MS = 1500;
const MAX_WORDS_FROM_NOTES = 100;
const TRANSLATE_CONCURRENCY = 3;

type SaveState = "idle" | "saving" | "saved" | "error";
type PanelMode = "edit" | "create" | "done";

interface ParsedPair {
  word: string;
  translation: string;
}

/**
 * Split note lines into word/translation pairs. A line like
 * "hello - ahoj" becomes a full pair; a bare line becomes a word whose
 * translation is filled by AI during set creation.
 */
function parseNotesToPairs(content: string): ParsedPair[] {
  const separators = ["\t", " - ", " – ", " — ", " = ", ";"];
  const pairs: ParsedPair[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    let word = line;
    let translation = "";
    for (const sep of separators) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        word = line.slice(0, idx).trim();
        translation = line.slice(idx + sep.length).trim();
        break;
      }
    }

    if (!word || word.length > 100) continue;
    pairs.push({ word, translation: translation.slice(0, 200) });
    if (pairs.length >= MAX_WORDS_FROM_NOTES) break;
  }

  return pairs;
}

/**
 * Personal notes scratchpad — one free-text block per user, floating in the
 * bottom-left corner. Content autosaves (last write wins) via /api/notes and
 * can be turned into a new flashcard set (missing translations are filled by
 * the existing /api/translate-word endpoint).
 */
export default function NotesWidget() {
  const { t, locale } = useI18n();
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("edit");

  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // "Create flashcards from notes" step
  const [setName, setSetName] = useState("");
  const [fromLanguage, setFromLanguage] = useState("");
  const [toLanguage, setToLanguage] = useState("");
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState("");
  const [createError, setCreateError] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const contentRef = useRef("");
  contentRef.current = content;

  const parsedPairs = useMemo(() => parseNotesToPairs(content), [content]);
  const missingTranslations = useMemo(
    () => parsedPairs.filter((p) => !p.translation).length,
    [parsedPairs]
  );

  // Track auth the same way AIChatButton does (localStorage "user").
  useEffect(() => {
    setIsMounted(true);
    const checkAuth = () => {
      if (typeof window !== "undefined") {
        setIsLoggedIn(!!localStorage.getItem("user"));
      }
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    const interval = setInterval(checkAuth, 500);
    return () => {
      window.removeEventListener("storage", checkAuth);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLoggedIn(!!localStorage.getItem("user"));
    }
    // Assume the dashboard is loading until it reports otherwise, so the notes
    // button does not flash on top of the dashboard loading screen.
    setIsDashboardLoading(pathname === "/dashboard");
  }, [pathname]);

  // Mirror the AI chat button: hide while the dashboard is still loading.
  useEffect(() => {
    const handleDashboardLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ loading?: boolean }>).detail;
      if (detail?.loading !== undefined) {
        setIsDashboardLoading(detail.loading);
      }
    };
    window.addEventListener("dashboardLoading", handleDashboardLoading);
    return () => {
      window.removeEventListener("dashboardLoading", handleDashboardLoading);
    };
  }, []);

  const persist = useCallback(async (value: string) => {
    dirtyRef.current = false;
    setSaveState("saving");
    try {
      const response = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch {
      dirtyRef.current = true;
      setSaveState("error");
    }
  }, []);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (dirtyRef.current) {
      void persist(contentRef.current);
    }
  }, [persist]);

  const handleChange = (value: string) => {
    setContent(value);
    dirtyRef.current = true;
    setSaveState("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(contentRef.current);
    }, AUTOSAVE_DELAY_MS);
  };

  const openPanel = async () => {
    setIsOpen(true);
    if (loaded) return;
    setLoadError("");
    try {
      const response = await fetch("/api/notes");
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as { content?: string };
      setContent(typeof data.content === "string" ? data.content : "");
      setLoaded(true);
    } catch {
      setLoadError(t("notes.loadFailed"));
    }
  };

  const closePanel = useCallback(() => {
    flushSave();
    setIsOpen(false);
    setMode("edit");
    setCreateError("");
  }, [flushSave]);

  // Escape closes the panel; pending changes are flushed on close/unload.
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closePanel]);

  useEffect(() => {
    const handleBeforeUnload = () => flushSave();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flushSave]);

  const openCreateStep = () => {
    flushSave();
    setCreateError("");
    setSetName(`${t("notes.defaultSetName")} ${new Date().toLocaleDateString(locale)}`);
    setMode("create");
  };

  const handleCreateSet = async () => {
    setCreateError("");

    if (!setName.trim()) {
      setCreateError(t("createSet.nameRequired"));
      return;
    }
    if (!fromLanguage || !toLanguage) {
      setCreateError(t("notes.selectLanguages"));
      return;
    }
    if (fromLanguage === toLanguage) {
      setCreateError(t("createSet.languagesDifferent"));
      return;
    }
    if (parsedPairs.length === 0) {
      setCreateError(t("notes.noWords"));
      return;
    }

    setCreating(true);
    try {
      // Fill missing translations via the existing per-word AI endpoint,
      // a few requests at a time.
      const pairs = parsedPairs.map((p) => ({ ...p }));
      const missing = pairs.filter((p) => !p.translation);
      let done = 0;

      for (let i = 0; i < missing.length; i += TRANSLATE_CONCURRENCY) {
        const chunk = missing.slice(i, i + TRANSLATE_CONCURRENCY);
        await Promise.all(
          chunk.map(async (pair) => {
            const response = await fetch("/api/translate-word", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                word: pair.word,
                fromLanguage,
                toLanguage,
                translateToOneWord: true,
              }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(body.error || t("notes.createFailed"));
            }
            pair.translation = String(body.translation || "").trim();
            done += 1;
            setCreateProgress(
              t("notes.translating", { current: done, total: missing.length })
            );
          })
        );
      }

      const invalid = pairs.filter((p) => !p.translation);
      if (invalid.length > 0) {
        throw new Error(t("notes.createFailed"));
      }

      setCreateProgress(t("createSet.creating"));
      const response = await fetch("/api/flashcard-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: setName.trim(),
          fromLanguage,
          toLanguage,
          tags: [],
          words: pairs,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || t("notes.createFailed"));
      }

      setMode("done");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : t("notes.createFailed")
      );
    } finally {
      setCreating(false);
      setCreateProgress("");
    }
  };

  if (
    !isMounted ||
    !isLoggedIn ||
    isDashboardLoading ||
    isJoinOnlyLiveBrowser()
  ) {
    return null;
  }

  const statusText =
    saveState === "saving"
      ? t("notes.saving")
      : saveState === "saved"
      ? t("notes.saved")
      : saveState === "error"
      ? t("notes.saveFailed")
      : "";

  const selectClass =
    "w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white cursor-pointer";

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 left-4 z-40 w-80 max-w-[calc(100vw-2rem)] h-96 flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {mode === "edit" ? t("notes.title") : t("notes.newSetTitle")}
            </h3>
            <button
              type="button"
              onClick={closePanel}
              aria-label={t("notes.close")}
              title={t("notes.close")}
              className="p-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {mode === "edit" && (
            <>
              {loadError ? (
                <p className="flex-1 p-4 text-sm text-red-600 dark:text-red-400">
                  {loadError}
                </p>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => handleChange(e.target.value)}
                  maxLength={MAX_LENGTH}
                  placeholder={t("notes.placeholder")}
                  aria-label={t("notes.title")}
                  className="flex-1 w-full resize-none p-4 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                />
              )}

              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span
                    className={
                      saveState === "error"
                        ? "text-red-600 dark:text-red-400"
                        : ""
                    }
                    role="status"
                    aria-live="polite"
                  >
                    {statusText}
                  </span>
                  <span>
                    {t("notes.charCount", {
                      count: content.length,
                      max: MAX_LENGTH,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openCreateStep}
                  disabled={parsedPairs.length === 0 || !loaded}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {t("notes.createCards")}
                  {parsedPairs.length > 0
                    ? ` (${t("notes.wordsFound", { count: parsedPairs.length })})`
                    : ""}
                </button>
              </div>
            </>
          )}

          {mode === "create" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                  <label
                    htmlFor="notes-set-name"
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t("createSet.setName")}
                  </label>
                  <input
                    id="notes-set-name"
                    type="text"
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    maxLength={100}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="notes-from-lang"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t("createSet.fromLanguage")}
                    </label>
                    <select
                      id="notes-from-lang"
                      value={fromLanguage}
                      onChange={(e) => setFromLanguage(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {getLanguageLabel(lang.value, locale)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="notes-to-lang"
                      className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t("createSet.toLanguage")}
                    </label>
                    <select
                      id="notes-to-lang"
                      value={toLanguage}
                      onChange={(e) => setToLanguage(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {getLanguageLabel(lang.value, locale)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("notes.wordsFound", { count: parsedPairs.length })}
                  </p>
                  <ul className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                    {parsedPairs.map((pair, index) => (
                      <li
                        key={`${pair.word}-${index}`}
                        className="px-2 py-1 text-xs text-gray-800 dark:text-gray-200"
                      >
                        <span className="font-medium">{pair.word}</span>
                        {pair.translation && (
                          <span className="text-gray-500 dark:text-gray-400">
                            {" "}
                            — {pair.translation}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {missingTranslations > 0 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t("notes.missingHint", { count: missingTranslations })}
                    </p>
                  )}
                </div>

                {createError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {createError}
                  </p>
                )}
                {creating && createProgress && (
                  <p
                    className="text-xs text-gray-500 dark:text-gray-400"
                    role="status"
                    aria-live="polite"
                  >
                    {createProgress}
                  </p>
                )}
              </div>

              <div className="flex gap-2 px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setMode("edit");
                    setCreateError("");
                  }}
                  disabled={creating}
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {t("notes.back")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateSet()}
                  disabled={creating}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {creating ? t("createSet.creating") : t("createSet.create")}
                </button>
              </div>
            </>
          )}

          {mode === "done" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("notes.createdTitle")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("notes.createdHint")}
              </p>
              <button
                type="button"
                onClick={() => window.location.assign("/dashboard")}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
              >
                {t("notes.showSets")}
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {t("notes.back")}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => (isOpen ? closePanel() : void openPanel())}
        aria-label={isOpen ? t("notes.close") : t("notes.open")}
        title={isOpen ? t("notes.close") : t("notes.open")}
        className="fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-colors cursor-pointer active:scale-[0.98]"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>
    </>
  );
}
