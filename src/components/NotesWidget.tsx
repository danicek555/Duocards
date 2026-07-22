"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { isJoinOnlyLiveBrowser } from "@/lib/liveGameHost";

const MAX_LENGTH = 20000;
const AUTOSAVE_DELAY_MS = 1500;

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Personal notes scratchpad — one free-text block per user, floating in the
 * bottom-left corner. Content autosaves (last write wins) via /api/notes.
 */
export default function NotesWidget() {
  const { t } = useI18n();
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const contentRef = useRef("");
  contentRef.current = content;

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
  }, [pathname]);

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

  if (!isMounted || !isLoggedIn || isJoinOnlyLiveBrowser()) {
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

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 left-4 z-40 w-80 max-w-[calc(100vw-2rem)] h-96 flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("notes.title")}
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

          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span
              className={
                saveState === "error" ? "text-red-600 dark:text-red-400" : ""
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
