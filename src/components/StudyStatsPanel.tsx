"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";

interface HeatmapDay {
  date: string;
  count: number;
  correct: number;
  again: number;
  uniqueWords: number;
  avgMs: number | null;
}

interface StatsResponse {
  generatedAt: string;
  tiles: {
    streakDays: number;
    reviewsToday: number;
    dueToday: number;
    accuracy7d: number | null;
    reviews7d: number;
    totalWords: number;
    matureWords: number;
    matureThresholdDays: number;
  };
  heatmap: HeatmapDay[];
  daily: { date: string; reviews: number; correct: number }[];
  forecast: { date: string; due: number }[];
  memory: { unseen: number; learning: number; young: number; mature: number };
  hardestWords: {
    id: number;
    word: string;
    translation: string;
    setName: string | null;
    lapses: number;
    reviews: number;
    accuracy: number;
  }[];
  perSet: {
    setId: number;
    name: string;
    words: number;
    due: number;
    accuracy: number | null;
    lastStudiedAt: string | null;
  }[];
  response: { avgMs: number | null; previousAvgMs: number | null };
  calibration: {
    from: number;
    to: number;
    count: number;
    predicted: number | null;
    actual: number | null;
  }[];
}

const percent = (value: number | null) =>
  value == null ? "—" : `${Math.round(value * 100)} %`;

const seconds = (ms: number | null) =>
  ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`;

function shortDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "numeric" });
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
      {hint && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function StreakTile({
  days,
  label,
  hint,
}: {
  days: number;
  label: string;
  hint: string;
}) {
  const active = days > 0;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border shadow-md p-4 ${
        active
          ? "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/15 dark:to-orange-600/15 border-amber-300 dark:border-amber-500/40"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      }`}
    >
      <span
        aria-hidden
        className={`absolute -right-1 -bottom-2 text-5xl select-none ${
          active ? "opacity-30" : "opacity-10 grayscale"
        }`}
      >
        🔥
      </span>
      <p
        className={`text-xs ${
          active
            ? "text-amber-700 dark:text-amber-300"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        🔥 {label}
      </p>
      <p
        className={`text-2xl font-bold mt-1 ${
          active
            ? "text-amber-600 dark:text-amber-400"
            : "text-gray-900 dark:text-white"
        }`}
      >
        {days}
      </p>
      <p
        className={`text-xs mt-0.5 ${
          active
            ? "text-amber-600/70 dark:text-amber-400/70"
            : "text-gray-400 dark:text-gray-500"
        }`}
      >
        {hint}
      </p>
    </div>
  );
}

function HeatmapTooltip({
  day,
  labels,
}: {
  day: HeatmapDay;
  labels: {
    reviews: string;
    accuracy: string;
    misses: string;
    uniqueWords: string;
    avgTime: string;
    noActivity: string;
  };
}) {
  const date = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
  return (
    <div className="rounded-xl bg-gray-900/95 dark:bg-gray-950/95 text-white shadow-xl border border-gray-700 px-3 py-2 text-xs leading-5 whitespace-nowrap">
      <p className="font-semibold mb-0.5">📅 {date}</p>
      {day.count === 0 ? (
        <p className="text-gray-400">{labels.noActivity}</p>
      ) : (
        <>
          <p>
            📚 {day.count} {labels.reviews}
          </p>
          <p>
            🎯 {labels.accuracy}: {Math.round((day.correct / day.count) * 100)}{" "}
            %
          </p>
          <p>
            ❌ {labels.misses}: {day.again}
          </p>
          <p>
            🔤 {day.uniqueWords} {labels.uniqueWords}
          </p>
          {day.avgMs != null && (
            <p>
              ⏱️ {labels.avgTime}: {(day.avgMs / 1000).toFixed(1)} s
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Heatmap({
  data,
  tooltipLabels,
}: {
  data: StatsResponse["heatmap"];
  tooltipLabels: Parameters<typeof HeatmapTooltip>[0]["labels"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    day: HeatmapDay;
    x: number;
    y: number;
  } | null>(null);
  const max = Math.max(1, ...data.map((day) => day.count));
  // Pad so columns align to weeks ending today.
  const cell = 12;
  const gap = 3;
  const weeks: StatsResponse["heatmap"][] = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));
  const width = weeks.length * (cell + gap);
  const height = 7 * (cell + gap);

  const showTooltip = (
    day: HeatmapDay,
    event: React.MouseEvent<SVGRectElement>,
  ) => {
    const container = containerRef.current;
    if (!container) return;
    const cellRect = event.currentTarget.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x = Math.min(
      Math.max(cellRect.left - containerRect.left + cellRect.width / 2, 70),
      containerRect.width - 70,
    );
    setHover({ day, x, y: cellRect.top - containerRect.top - 6 });
  };

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full"
        style={{ maxHeight: 130 }}
        role="img"
      >
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const alpha =
              day.count === 0 ? 0 : 0.25 + 0.75 * (day.count / max);
            return (
              <rect
                key={day.date}
                x={weekIndex * (cell + gap)}
                y={dayIndex * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                className="fill-gray-200 dark:fill-gray-700"
                style={
                  day.count > 0
                    ? { fill: `rgba(99, 102, 241, ${alpha.toFixed(2)})` }
                    : undefined
                }
                onMouseEnter={(event) => showTooltip(day, event)}
                onMouseLeave={() => setHover(null)}
              />
            );
          }),
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: hover.x,
            top: hover.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <HeatmapTooltip day={hover.day} labels={tooltipLabels} />
        </div>
      )}
    </div>
  );
}

function DailyChart({ data }: { data: StatsResponse["daily"] }) {
  const width = 600;
  const height = 150;
  const padding = 4;
  const max = Math.max(1, ...data.map((day) => day.reviews));
  const barWidth = (width - padding * 2) / data.length;
  const points = data
    .map((day, index) => {
      if (day.reviews === 0) return null;
      const x = padding + index * barWidth + barWidth / 2;
      const y = height - 18 - (day.correct / day.reviews) * (height - 40);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      {data.map((day, index) => {
        const barHeight = (day.reviews / max) * (height - 40);
        return (
          <rect
            key={day.date}
            x={padding + index * barWidth + 1}
            y={height - 18 - barHeight}
            width={Math.max(1, barWidth - 2)}
            height={barHeight}
            rx={2}
            fill="rgba(99, 102, 241, 0.75)"
          >
            <title>{`${day.date}: ${day.reviews} (${day.correct} ✓)`}</title>
          </rect>
        );
      })}
      {points && (
        <polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <text x={padding} y={height - 4} className="fill-gray-400" fontSize={10}>
        {shortDate(data[0]?.date ?? "")}
      </text>
      <text
        x={width - padding}
        y={height - 4}
        textAnchor="end"
        className="fill-gray-400"
        fontSize={10}
      >
        {shortDate(data[data.length - 1]?.date ?? "")}
      </text>
      <text x={padding} y={12} className="fill-gray-400" fontSize={10}>
        max {max}
      </text>
    </svg>
  );
}

function ForecastChart({ data }: { data: StatsResponse["forecast"] }) {
  const max = Math.max(1, ...data.map((day) => day.due));
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((day, index) => (
        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {day.due}
          </span>
          <div
            className={`w-full rounded-t-md ${
              index === 0 ? "bg-amber-500/80" : "bg-blue-500/70"
            }`}
            style={{ height: `${Math.max(4, (day.due / max) * 80)}px` }}
            title={`${day.date}: ${day.due}`}
          />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {shortDate(day.date)}
          </span>
        </div>
      ))}
    </div>
  );
}

function MemoryBar({
  memory,
  labels,
}: {
  memory: StatsResponse["memory"];
  labels: { unseen: string; learning: string; young: string; mature: string };
}) {
  const total = memory.unseen + memory.learning + memory.young + memory.mature;
  if (total === 0) return null;
  const segments = [
    { key: "mature", value: memory.mature, className: "bg-emerald-500" },
    { key: "young", value: memory.young, className: "bg-blue-400" },
    { key: "learning", value: memory.learning, className: "bg-purple-400" },
    { key: "unseen", value: memory.unseen, className: "bg-gray-300 dark:bg-gray-600" },
  ] as const;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${labels[segment.key]}: ${segment.value}`}
              />
            ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        {segments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${segment.className}`} />
            {labels[segment.key]} · {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function StudyStatsPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllSets, setShowAllSets] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/study/stats", {
        headers: {
          "X-Timezone-Offset": String(new Date().getTimezoneOffset()),
        },
      });
      if (response.status === 401) {
        router.push("/");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("stats.loadFailed"));
      }
      setData((await response.json()) as StatsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("stats.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error || t("stats.loadFailed")}
          </p>
          <button
            onClick={() => void fetchStats()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {t("stats.retry")}
          </button>
        </div>
      </div>
    );
  }

  const { tiles } = data;
  const responseDelta =
    data.response.avgMs != null && data.response.previousAvgMs != null
      ? data.response.avgMs - data.response.previousAvgMs
      : null;
  const calibrationRows = data.calibration.filter((bin) => bin.count > 0);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
          {t("stats.title")}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("stats.subtitle")}
        </p>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StreakTile
          days={tiles.streakDays}
          label={t("stats.tileStreak")}
          hint={t("stats.tileStreakHint")}
        />
        <Tile
          label={`✅ ${t("stats.tileReviewedToday")}`}
          value={String(tiles.reviewsToday)}
        />
        <Tile
          label={`⏰ ${t("stats.tileDueToday")}`}
          value={String(tiles.dueToday)}
        />
        <Tile
          label={`🎯 ${t("stats.tileAccuracy7d")}`}
          value={percent(tiles.accuracy7d)}
          hint={`${tiles.reviews7d} ${t("stats.reviewsShort")}`}
        />
        <Tile
          label={`📚 ${t("stats.tileTotalWords")}`}
          value={String(tiles.totalWords)}
        />
        <Tile
          label={`🌳 ${t("stats.tileMatureWords")}`}
          value={String(tiles.matureWords)}
          hint={`≥ ${tiles.matureThresholdDays} ${t("stats.daysShort")}`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card title={`🗓️ ${t("stats.heatmapTitle")}`}>
          <Heatmap
            data={data.heatmap}
            tooltipLabels={{
              reviews: t("stats.reviewsShort"),
              accuracy: t("stats.accuracyShort"),
              misses: t("stats.lapses"),
              uniqueWords: t("stats.uniqueWords"),
              avgTime: t("stats.avgTimeShort"),
              noActivity: t("stats.noActivity"),
            }}
          />
        </Card>
        <Card title={`📊 ${t("stats.dailyTitle")}`}>
          <DailyChart data={data.daily} />
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {t("stats.dailyLegend")}
          </p>
        </Card>
        <Card title={`🔮 ${t("stats.forecastTitle")}`}>
          <ForecastChart data={data.forecast} />
        </Card>
        <Card title={`🧠 ${t("stats.memoryTitle")}`}>
          <MemoryBar
            memory={data.memory}
            labels={{
              unseen: t("stats.memoryUnseen"),
              learning: t("stats.memoryLearning"),
              young: t("stats.memoryYoung"),
              mature: t("stats.memoryMature"),
            }}
          />
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("stats.responseAvg")}
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {seconds(data.response.avgMs)}
                {responseDelta != null && (
                  <span
                    className={`ml-2 text-xs font-medium ${
                      responseDelta <= 0 ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {responseDelta <= 0 ? "▼" : "▲"}{" "}
                    {(Math.abs(responseDelta) / 1000).toFixed(1)} s
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {calibrationRows.length > 0 && (
        <div className="mb-6">
          <Card title={`⚖️ ${t("stats.calibrationTitle")}`}>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              {t("stats.calibrationHint")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                    <th className="py-1.5 pr-4 font-medium">
                      {t("stats.calibrationBin")}
                    </th>
                    <th className="py-1.5 pr-4 font-medium">
                      {t("stats.calibrationPredicted")}
                    </th>
                    <th className="py-1.5 pr-4 font-medium">
                      {t("stats.calibrationActual")}
                    </th>
                    <th className="py-1.5 font-medium">
                      {t("stats.reviewsShort")}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {calibrationRows.map((bin) => (
                    <tr
                      key={bin.from}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="py-1.5 pr-4">
                        {Math.round(bin.from * 100)}–{Math.round(bin.to * 100)} %
                      </td>
                      <td className="py-1.5 pr-4">{percent(bin.predicted)}</td>
                      <td className="py-1.5 pr-4 font-medium">
                        {percent(bin.actual)}
                      </td>
                      <td className="py-1.5">{bin.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title={`💪 ${t("stats.hardestTitle")}`}>
          {data.hardestWords.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("stats.hardestEmpty")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-1.5 pr-4 font-medium">{t("stats.word")}</th>
                  <th className="py-1.5 pr-4 font-medium">{t("stats.set")}</th>
                  <th className="py-1.5 pr-4 font-medium">
                    {t("stats.accuracyShort")}
                  </th>
                  <th className="py-1.5 font-medium">{t("stats.lapses")}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {data.hardestWords.map((word) => (
                  <tr
                    key={word.id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-1.5 pr-4">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {word.word}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        {" "}
                        · {word.translation}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-xs">{word.setName ?? "—"}</td>
                    <td className="py-1.5 pr-4">{percent(word.accuracy)}</td>
                    <td className="py-1.5">{word.lapses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={`🗂️ ${t("stats.perSetTitle")}`}>
          {data.perSet.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("stats.perSetEmpty")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-1.5 pr-4 font-medium">{t("stats.set")}</th>
                  <th className="py-1.5 pr-4 font-medium">{t("stats.words")}</th>
                  <th className="py-1.5 pr-4 font-medium">{t("stats.due")}</th>
                  <th className="py-1.5 pr-4 font-medium">
                    {t("stats.accuracyShort")}
                  </th>
                  <th className="py-1.5 font-medium">{t("stats.lastStudied")}</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {(showAllSets ? data.perSet : data.perSet.slice(0, 5)).map((set) => (
                  <tr
                    key={set.setId}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-1.5 pr-4 font-medium text-gray-900 dark:text-white">
                      {set.name}
                    </td>
                    <td className="py-1.5 pr-4">{set.words}</td>
                    <td className="py-1.5 pr-4">
                      {set.due > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {set.due}
                        </span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="py-1.5 pr-4">{percent(set.accuracy)}</td>
                    <td className="py-1.5 text-xs">
                      {set.lastStudiedAt
                        ? new Date(set.lastStudiedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.perSet.length > 5 && (
            <button
              onClick={() => setShowAllSets((prev) => !prev)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  showAllSets ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {showAllSets
                ? t("stats.showLess")
                : `${t("stats.showMore")} (${data.perSet.length - 5})`}
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
