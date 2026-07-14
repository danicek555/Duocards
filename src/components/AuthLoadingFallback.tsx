"use client";

import AuthBackground from "@/components/AuthBackground";

export default function AuthLoadingFallback() {
  return (
    <AuthBackground>
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Načítám...</p>
      </div>
    </AuthBackground>
  );
}
