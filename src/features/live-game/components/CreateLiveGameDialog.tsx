"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";

export interface LiveGameSetOption {
  id: number;
  name: string;
  words: { id: number }[];
}

interface CreateLiveGameDialogProps {
  open: boolean;
  sets: LiveGameSetOption[];
  selectedSetIds: number[];
  questionCount: number;
  questionTimeSeconds: number;
  loadingSets: boolean;
  creating: boolean;
  error: string | null;
  onToggleSet: (id: number) => void;
  onQuestionCountChange: (value: number) => void;
  onQuestionTimeChange: (value: number) => void;
  onClose: () => void;
  onCreate: () => void;
}

export default function CreateLiveGameDialog({
  open,
  sets,
  selectedSetIds,
  questionCount,
  questionTimeSeconds,
  loadingSets,
  creating,
  error,
  onToggleSet,
  onQuestionCountChange,
  onQuestionTimeChange,
  onClose,
  onCreate,
}: CreateLiveGameDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [creating, onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-create-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="border-b border-slate-200 px-6 py-5 dark:border-slate-700 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
            {t("liveGameV2.classicTitle")}
          </p>
          <h2 id="live-create-title" className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
            {t("liveGameV2.setupTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {t("liveGameV2.setupDesc")}
          </p>
        </header>

        <div className="space-y-7 px-6 py-6 sm:px-8">
          <fieldset>
            <legend className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              {t("liveGameV2.flashcardSets")}
            </legend>
            {loadingSets ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {t("liveGameV2.loadingSets")}
              </div>
            ) : sets.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                {t("liveGameV2.noSets")}
              </div>
            ) : (
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {sets.map((set) => {
                  const selected = selectedSetIds.includes(set.id);
                  return (
                    <li key={set.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => onToggleSet(set.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-900 dark:text-white">
                          {set.name}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                          {t("liveGame.cardsCount", { count: set.words.length })}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedSetIds.length > 0 && (
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("liveGameV2.selectedSets", { count: selectedSetIds.length })}
              </p>
            )}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="live-question-count" className="mb-2 block text-sm font-bold text-slate-900 dark:text-white">
                {t("liveGameV2.questions")}
              </label>
              <select id="live-question-count" value={questionCount} onChange={(event) => onQuestionCountChange(Number(event.target.value))} className="w-full cursor-pointer rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                {[5, 10, 15, 20].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="live-question-time" className="mb-2 block text-sm font-bold text-slate-900 dark:text-white">
                {t("liveGameV2.questionTime")}
              </label>
              <select id="live-question-time" value={questionTimeSeconds} onChange={(event) => onQuestionTimeChange(Number(event.target.value))} className="w-full cursor-pointer rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                {[10, 15, 20, 30].map((value) => (
                  <option key={value} value={value}>{t("liveGameV2.seconds", { count: value })}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-700 sm:px-8">
          <button type="button" onClick={onClose} disabled={creating} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer">
            {t("liveGameV2.cancel")}
          </button>
          <button type="button" onClick={onCreate} disabled={creating || loadingSets || sets.length === 0 || selectedSetIds.length === 0} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
            {creating ? t("liveGameV2.creating") : t("liveGameV2.createRoom")}
          </button>
        </footer>
      </div>
    </div>
  );
}
