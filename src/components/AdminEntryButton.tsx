"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Plovoucí vstup do administrace. Vidí ho jen přihlášený admin a jen na
 * dashboardu — všem ostatním se nevykreslí vůbec (server vrací isAdmin
 * podle role v databázi, tlačítko je čistě pohodlnostní zkratka).
 */
export default function AdminEntryButton() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  // Assume the dashboard is loading until it reports otherwise, so the button
  // never flashes on top of the dashboard loading screen.
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const onDashboard = pathname === "/dashboard";

  useEffect(() => {
    if (!onDashboard) return;
    let cancelled = false;
    fetch("/api/admin/me")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { isAdmin?: boolean };
        if (!cancelled) setIsAdmin(payload.isAdmin === true);
      })
      .catch(() => {
        // Bez odpovědi se tlačítko prostě neukáže.
      });
    return () => {
      cancelled = true;
    };
  }, [onDashboard]);

  // Mirror the notes / AI chat buttons: hide while the dashboard is loading.
  useEffect(() => {
    setIsDashboardLoading(pathname === "/dashboard");
    const handleDashboardLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ loading?: boolean }>).detail;
      if (detail?.loading !== undefined) setIsDashboardLoading(detail.loading);
    };
    window.addEventListener("dashboardLoading", handleDashboardLoading);
    return () => {
      window.removeEventListener("dashboardLoading", handleDashboardLoading);
    };
  }, [pathname]);

  if (!onDashboard || !isAdmin || isDashboardLoading) return null;

  return (
    <Link
      href="/admin"
      className="fixed bottom-24 end-4 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30 ring-1 ring-white/15 transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 6v5c0 4.6 3.2 8.4 8 10 4.8-1.6 8-5.4 8-10V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      Administrace
    </Link>
  );
}
