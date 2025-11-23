"use client";

interface AuthToggleProps {
  isLogin: boolean;
  onToggle: (isLogin: boolean) => void;
}

export default function AuthToggle({ isLogin, onToggle }: AuthToggleProps) {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
      <button
        type="button"
        onClick={() => onToggle(true)}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
          isLogin
            ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
          !isLogin
            ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        Register
      </button>
    </div>
  );
}
