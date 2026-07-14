"use client";

interface AuthPageHeaderProps {
  badge: string;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
}

export default function AuthPageHeader({
  badge,
  subtitle,
  children,
}: AuthPageHeaderProps) {
  return (
    <div className="mb-8 text-center">
      <span className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 font-mono text-xs font-medium tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
        {badge}
      </span>
      <h1 className="mb-2 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
        DuoCards
      </h1>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {subtitle}
      </p>
      {children}
    </div>
  );
}
