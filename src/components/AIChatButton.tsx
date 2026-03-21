"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import AIChatModal from "./AIChatModal";

interface AIChatButtonProps {
  onCoinsUpdate?: (coins: number) => void;
}

export default function AIChatButton({ onCoinsUpdate }: AIChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const pathname = usePathname();

  // Check if user is logged in
  useEffect(() => {
    setIsMounted(true);
    const checkAuth = () => {
      if (typeof window !== "undefined") {
        const userData = localStorage.getItem("user");
        setIsLoggedIn(!!userData);
      }
    };

    // Check immediately on mount
    checkAuth();

    // Listen for auth changes (login/logout)
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleStorageChange);

    // Also check periodically in case localStorage is changed in the same tab
    const interval = setInterval(checkAuth, 500);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Re-check auth when pathname changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const userData = localStorage.getItem("user");
      setIsLoggedIn(!!userData);
    }
    if (pathname === "/live-game") {
      setIsOpen(false);
    }
    // Set loading state based on pathname
    if (pathname === "/dashboard") {
      // Assume loading when on dashboard until we get a "not loading" event
      setIsDashboardLoading(true);
    } else {
      setIsDashboardLoading(false);
    }
  }, [pathname]);

  // Listen for dashboard loading state
  useEffect(() => {
    const handleDashboardLoading = (event: Event) => {
      const customEvent = event as CustomEvent<{ loading: boolean }>;
      if (customEvent.detail?.loading !== undefined) {
        setIsDashboardLoading(customEvent.detail.loading);
      }
    };

    window.addEventListener("dashboardLoading", handleDashboardLoading);

    return () => {
      window.removeEventListener("dashboardLoading", handleDashboardLoading);
    };
  }, []);

  // Listen for close events from other modals
  useEffect(() => {
    const handleCloseAIChat = () => {
      setIsOpen(false);
    };

    window.addEventListener("closeAIChat", handleCloseAIChat);

    return () => {
      window.removeEventListener("closeAIChat", handleCloseAIChat);
    };
  }, []);

  // Don't render until mounted (to avoid hydration issues)
  if (!isMounted) {
    return null;
  }

  // Don't render on login/register page or verify page
  if (pathname === "/" || pathname === "/verify") {
    return null;
  }

  // Live game has its own chat; hide the floating AI helper there
  if (pathname === "/live-game") {
    return null;
  }

  // Don't render if user is not logged in
  if (!isLoggedIn) {
    return null;
  }

  // Don't render if dashboard is loading
  if (isDashboardLoading) {
    return null;
  }

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed right-4 bottom-4 z-40 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group ${
          isOpen ? "scale-95" : ""
        }`}
        aria-label="Open AI Chat Helper"
      >
        <div className="relative">
          {isOpen ? (
            <svg
              className="w-6 h-6 md:w-7 md:h-7"
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
          ) : (
            <>
              <svg
                className="w-6 h-6 md:w-7 md:h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              {/* Pulse animation */}
              <div className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-75" />
            </>
          )}
        </div>
        {/* Tooltip */}
        {!isOpen && (
          <div className="absolute right-full mr-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
              AI Duocard Helper
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
            </div>
          </div>
        )}
      </button>

      {/* Chat Modal */}
      <AIChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onCoinsUpdate={onCoinsUpdate}
      />
    </>
  );
}
