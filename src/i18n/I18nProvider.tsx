"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createTranslator } from "./translate";
import { getStoredLocale, persistLocale } from "./storage";
import { DEFAULT_LOCALE, isRtlLocale, type Locale } from "./types";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale, options?: { persist?: boolean; sync?: boolean }) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

async function syncLocaleToServer(locale: Locale) {
  try {
    await fetch("/api/user/locale", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
  } catch {
    // Guest users or offline — locale stays in localStorage only
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredLocale();
    setLocaleState(stored);
    document.documentElement.lang = stored;
    document.documentElement.dir = isRtlLocale(stored) ? "rtl" : "ltr";
    setReady(true);
  }, []);

  const setLocale = useCallback(
    (
      nextLocale: Locale,
      options?: { persist?: boolean; sync?: boolean },
    ) => {
      const persist = options?.persist ?? true;
      const sync = options?.sync ?? true;

      setLocaleState(nextLocale);
      document.documentElement.dir = isRtlLocale(nextLocale) ? "rtl" : "ltr";
      if (persist) {
        persistLocale(nextLocale);
      } else {
        document.documentElement.lang = nextLocale;
      }
      if (sync) {
        void syncLocaleToServer(nextLocale);
      }
    },
    [],
  );

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
