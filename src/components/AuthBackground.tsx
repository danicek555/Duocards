"use client";

import { useI18n } from "@/i18n/I18nProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const FLOATING_CARDS = [
  { word: "bonjour", hintKey: "auth.floatingCards.bonjour", className: "top-[12%] right-[8%] rotate-[2.5deg]" },
  { word: "ciao", hintKey: "auth.floatingCards.ciao", className: "top-[28%] left-[6%] -rotate-2" },
  { word: "danke", hintKey: "auth.floatingCards.danke", className: "bottom-[22%] right-[10%] rotate-[-2deg]" },
  { word: "serendipity", hintKey: "auth.floatingCards.serendipity", className: "bottom-[14%] left-[8%] rotate-[2deg]" },
  { word: "Fernweh", hintKey: "auth.floatingCards.fernweh", className: "top-[48%] right-[4%] rotate-[3deg] hidden xl:flex" },
  { word: "木漏れ日", hintKey: "auth.floatingCards.komorebi", className: "top-[62%] left-[3%] -rotate-[2.5deg] hidden lg:flex" },
] as const;

function AuthCardlet({
  word,
  hint,
  className,
}: {
  word: string;
  hint: string;
  className: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-0 hidden sm:flex flex-col gap-0.5 rounded-[14px] border border-gray-200/80 bg-white/70 px-4 py-3 shadow-md backdrop-blur-sm dark:border-gray-700/60 dark:bg-gray-800/60 ${className}`}
    >
      <span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        {word}
      </span>
      <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
        {hint}
      </span>
    </div>
  );
}

export default function AuthBackground({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(129,140,248,0.08),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(124,58,237,0.1),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_bottom_right,rgba(124,58,237,0.06),transparent_50%)]"
      />

      {FLOATING_CARDS.map((card) => (
        <AuthCardlet
          key={card.word}
          word={card.word}
          hint={t(card.hintKey)}
          className={card.className}
        />
      ))}

      <nav className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 sm:px-10">
        <a
          href="https://www.duocards.xyz/"
          className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent"
        >
          {t("common.brand")}
        </a>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <a
            href="https://www.duocards.xyz/"
            className="hidden text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 sm:inline"
          >
            {t("common.backToWeb")}
          </a>
        </div>
      </nav>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10">
        {children}
      </div>
    </div>
  );
}
