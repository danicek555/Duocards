"use client";

interface AuthToggleProps {
  isLogin: boolean;
  onToggle: (isLogin: boolean) => void;
}

export default function AuthToggle({ isLogin, onToggle }: AuthToggleProps) {
  return (
    <div className="mb-6 flex rounded-xl bg-gray-100 p-1 dark:bg-gray-700/80">
      <button
        type="button"
        onClick={() => onToggle(true)}
        className={`flex-1 rounded-lg py-2.5 px-4 text-sm font-medium transition-all ${
          isLogin
            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        }`}
      >
        Přihlásit se
      </button>
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={`flex-1 rounded-lg py-2.5 px-4 text-sm font-medium transition-all ${
          !isLogin
            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        }`}
      >
        Registrace
      </button>
    </div>
  );
}
