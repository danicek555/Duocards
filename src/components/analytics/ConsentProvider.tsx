"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Tracks whether the user has agreed to analytics cookies.
 *
 * `null` means the user has not decided yet (show the banner); "granted" and
 * "denied" are the explicit choices. Analytics scripts (GA4, Hotjar) are only
 * mounted while the consent is "granted", so nothing is loaded before opt-in.
 */
export type ConsentState = "granted" | "denied";

const STORAGE_KEY = "duocards_analytics_consent";

interface ConsentContextValue {
  consent: ConsentState | null;
  /** True once the stored choice has been read on the client. */
  hydrated: boolean;
  grant: () => void;
  deny: () => void;
  /** Clears the stored choice so the banner is shown again. */
  reset: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "granted" || stored === "denied") setConsent(stored);
    } catch {
      // localStorage may be unavailable (private mode); default to undecided.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((value: ConsentState) => {
    setConsent(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore write failures; the choice still applies for this session.
    }
  }, []);

  const grant = useCallback(() => persist("granted"), [persist]);
  const deny = useCallback(() => persist("denied"), [persist]);
  const reset = useCallback(() => {
    setConsent(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, hydrated, grant, deny, reset }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return ctx;
}
