"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Floating "generating…" chip driven by the global `aiGenerationActive` event.
 * Because it lives in the root layout (not inside the generate form), it keeps
 * showing even after the user navigates away while an AI generation is still
 * running. A counter supports more than one generation at once.
 */
export default function AiGenerationIndicator() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setActive((count) => Math.max(0, count + (detail?.active ? 1 : -1)));
    };
    window.addEventListener("aiGenerationActive", handler);
    return () => window.removeEventListener("aiGenerationActive", handler);
  }, []);

  if (active <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      <svg
        className="h-4 w-4 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {t("createSet.generatingInBackground")}
    </div>
  );
}
