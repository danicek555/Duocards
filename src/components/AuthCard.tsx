"use client";

export default function AuthCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-8 shadow-xl backdrop-blur-xl dark:border-gray-700/60 dark:bg-gray-800/80">
      {children}
    </div>
  );
}
