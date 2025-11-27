"use client";

import { useState } from "react";

interface JoinPublicSetModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function JoinPublicSetModal({
  onClose,
  onSuccess,
}: JoinPublicSetModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Normalize code (remove spaces, convert to uppercase)
    const normalizedCode = code.trim().replace(/\s+/g, "").toUpperCase();

    // Validate format (should be XXXX-XXXX)
    if (!/^\d{4}-\d{4}$/.test(normalizedCode)) {
      setError("Invalid code format. Please use format XXXX-XXXX");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/flashcard-sets/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join flashcard set");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join flashcard set"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");

    // Format as XXXX-XXXX
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
    }

    setCode(formatted);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-hidden"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full border border-purple-200 dark:border-purple-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Join Public Flashcard Set
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter Public Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="XXXX-XXXX"
              maxLength={9}
              className="w-full px-3 py-2 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest font-mono"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Enter the 8-digit code in format XXXX-XXXX
            </p>
          </div>

          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Joining..." : "Join Set"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
