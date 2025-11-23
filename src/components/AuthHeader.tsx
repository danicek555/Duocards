"use client";

interface AuthHeaderProps {
  isLogin: boolean;
}

export default function AuthHeader({ isLogin }: AuthHeaderProps) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        DuoCards
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        {isLogin ? "Welcome back!" : "Create your account"}
      </p>
    </div>
  );
}
