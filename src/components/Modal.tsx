"use client";

import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  showCloseButton?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type,
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          icon: "text-green-600 dark:text-green-400",
          bg: "bg-green-50 dark:bg-green-900/20",
          border: "border-green-200 dark:border-green-800",
        };
      case "error":
        return {
          icon: "text-red-600 dark:text-red-400",
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-200 dark:border-red-800",
        };
      case "warning":
        return {
          icon: "text-yellow-600 dark:text-yellow-400",
          bg: "bg-yellow-50 dark:bg-yellow-900/20",
          border: "border-yellow-200 dark:border-yellow-800",
        };
      case "info":
        return {
          icon: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-50 dark:bg-blue-900/20",
          border: "border-blue-200 dark:border-blue-800",
        };
      default:
        return {
          icon: "text-gray-600 dark:text-gray-400",
          bg: "bg-gray-50 dark:bg-gray-900/20",
          border: "border-gray-200 dark:border-gray-800",
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "error":
        return (
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "warning":
        return (
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "info":
        return (
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg ${styles.bg} ${styles.border} border-2`}
        >
          <div className="px-6 py-8 sm:px-8">
            <div className="flex items-center justify-center mb-4">
              <div className={`${styles.icon}`}>{getIcon()}</div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {showCloseButton && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
