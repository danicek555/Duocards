"use client";

interface AuthSubmitButtonProps {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export default function AuthSubmitButton({
  children,
  disabled = false,
  loading = false,
  loadingText,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-2.5 px-4 font-medium text-white shadow-md shadow-purple-600/25 transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
        disabled || loading
          ? "cursor-not-allowed opacity-50"
          : "hover:brightness-110 hover:shadow-lg hover:shadow-purple-600/35 active:scale-[0.98]"
      }`}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg
            className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
