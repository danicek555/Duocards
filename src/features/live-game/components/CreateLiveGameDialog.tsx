"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  LIVE_GAME_DEFINITIONS,
  LIVE_GAME_MODE_DETAIL_TRANSLATIONS,
  LIVE_GAME_MODE_TRANSLATIONS,
  MARATHON_DURATION_OPTIONS_MINUTES,
  SELECTABLE_LIVE_GAME_MODE_IDS,
  type SelectableLiveGameModeId,
} from "../gameModes";

function durationLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  minutes: number,
) {
  if (minutes % (24 * 60) === 0) {
    return t("liveGameV2.durationDays", { count: minutes / (24 * 60) });
  }
  return t("liveGameV2.durationHours", { count: Math.round(minutes / 60) });
}

export interface LiveGameSetOption {
  id: number;
  name: string;
  words: { id: number }[];
}

interface CreateLiveGameDialogProps {
  open: boolean;
  sets: LiveGameSetOption[];
  selectedSetIds: number[];
  modeId: SelectableLiveGameModeId;
  questionCount: number;
  questionTimeSeconds: number;
  durationMinutes: number;
  loadingSets: boolean;
  creating: boolean;
  error: string | null;
  onToggleSet: (id: number) => void;
  onModeChange: (modeId: SelectableLiveGameModeId) => void;
  onQuestionCountChange: (value: number) => void;
  onQuestionTimeChange: (value: number) => void;
  onDurationChange: (value: number) => void;
  onClose: () => void;
  onCreate: () => void;
}

export default function CreateLiveGameDialog({
  open,
  sets,
  selectedSetIds,
  modeId,
  questionCount,
  questionTimeSeconds,
  durationMinutes,
  loadingSets,
  creating,
  error,
  onToggleSet,
  onModeChange,
  onQuestionCountChange,
  onQuestionTimeChange,
  onDurationChange,
  onClose,
  onCreate,
}: CreateLiveGameDialogProps) {
  const { t } = useI18n();
  const isSprint = modeId === "sprint";
  const isMarathon = modeId === "marathon";
  const [detailModeId, setDetailModeId] =
    useState<SelectableLiveGameModeId | null>(null);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The detail popup closes first; a second Escape closes the dialog.
      if (detailModeId) setDetailModeId(null);
      else if (!creating) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [creating, detailModeId, onClose, open]);

  useEffect(() => {
    if (!open) setDetailModeId(null);
  }, [open]);

  if (!open) return null;

  const detail = detailModeId
    ? {
        id: detailModeId,
        meta: LIVE_GAME_DEFINITIONS[detailModeId],
        labels: LIVE_GAME_MODE_TRANSLATIONS[detailModeId],
        texts: LIVE_GAME_MODE_DETAIL_TRANSLATIONS[detailModeId],
      }
    : null;

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
            {t(LIVE_GAME_MODE_TRANSLATIONS[modeId].label)}
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
              {t("liveGameV2.chooseMode")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SELECTABLE_LIVE_GAME_MODE_IDS.map((id) => {
                const selected = id === modeId;
                return (
                  <div key={id} className="relative">
                    <button
                      type="button"
                      onClick={() => onModeChange(id)}
                      aria-pressed={selected}
                      disabled={creating}
                      className={`h-full w-full rounded-2xl border p-4 pe-10 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                        selected
                          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/15"
                          : "border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-500/60"
                      }`}
                    >
                      <span className={`block text-sm font-black ${selected ? "text-blue-700 dark:text-blue-200" : "text-slate-900 dark:text-white"}`}>
                        {t(LIVE_GAME_MODE_TRANSLATIONS[id].label)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {t(LIVE_GAME_MODE_TRANSLATIONS[id].description)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailModeId(id)}
                      aria-label={`${t("liveGameV2.modeDetailOpen")}: ${t(LIVE_GAME_MODE_TRANSLATIONS[id].label)}`}
                      title={t("liveGameV2.modeDetailOpen")}
                      className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-500 dark:hover:bg-blue-500/20 dark:hover:text-blue-300 cursor-pointer"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5M12 8h.01" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </fieldset>

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

          {isSprint ? (
            <p className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
              {t("liveGameV2.sprintSetupHint")}
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="live-question-count" className="mb-2 block text-sm font-bold text-slate-900 dark:text-white">
                  {t("liveGameV2.questions")}
                </label>
                <select id="live-question-count" value={questionCount} onChange={(event) => onQuestionCountChange(Number(event.target.value))} className="w-full cursor-pointer rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                  {(isMarathon ? [10, 20, 30, 50] : [5, 10, 15, 20]).map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              {isMarathon ? (
                <div>
                  <label htmlFor="live-duration" className="mb-2 block text-sm font-bold text-slate-900 dark:text-white">
                    {t("liveGameV2.marathonDuration")}
                  </label>
                  <select id="live-duration" value={durationMinutes} onChange={(event) => onDurationChange(Number(event.target.value))} className="w-full cursor-pointer rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                    {MARATHON_DURATION_OPTIONS_MINUTES.map((value) => (
                      <option key={value} value={value}>{durationLabel(t, value)}</option>
                    ))}
                  </select>
                </div>
              ) : (
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
              )}
            </div>
          )}

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

      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="live-mode-detail-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailModeId(null);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
                  {t("liveGameV2.modeDetailTitle")}
                </p>
                <h3 id="live-mode-detail-title" className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                  {t(detail.labels.label)}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                    {detail.meta.pacing === "self-paced"
                      ? t("liveGameV2.detailSelfPaced")
                      : t("liveGameV2.detailSynchronized")}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {t("liveGameV2.detailPlayers", {
                      min: detail.meta.recommendedPlayers[0],
                      max: detail.meta.recommendedPlayers[1],
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModeId(null)}
                aria-label={t("common.close")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className="space-y-5 px-6 py-6">
              {(
                [
                  { title: "liveGameV2.detailFlowTitle", body: detail.texts.flow },
                  { title: "liveGameV2.detailScoringTitle", body: detail.texts.scoring },
                  { title: "liveGameV2.detailWinTitle", body: detail.texts.win },
                  { title: "liveGameV2.detailTipTitle", body: detail.texts.tip },
                ] as const
              ).map((section) => (
                <section key={section.title}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t(section.title)}
                  </h4>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {t(section.body)}
                  </p>
                </section>
              ))}
            </div>

            <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDetailModeId(null)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onModeChange(detail.id);
                  setDetailModeId(null);
                }}
                disabled={creating}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {t("liveGameV2.detailChoose")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
