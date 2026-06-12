"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Notification from "@/components/Notification";
import PasswordInput from "@/components/PasswordInput";
import PasswordRequirements from "@/components/PasswordRequirements";
import { validatePassword } from "@/lib/passwordValidation";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const hasToken = token.length > 0;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "warning" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  const passwordValidation = validatePassword(password);
  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const showNotification = (
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => {
    setNotification({ message, type, isVisible: true });
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        showNotification(
          data.message ||
            "If your account exists, we sent a reset link. Please check your spam or junk folder too.",
          "success"
        );
      } else {
        showNotification(data.error || "Failed to send reset email.", "error");
      }
    } catch {
      showNotification(
        "Network error. Please check your connection and try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.isValid) {
      showNotification(passwordValidation.message, "warning");
      return;
    }

    if (!passwordsMatch) {
      showNotification("Passwords do not match.", "error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        showNotification(
          "Password reset successful. Redirecting to login...",
          "success"
        );
        setTimeout(() => router.push("/"), 1500);
      } else {
        showNotification(data.error || "Failed to reset password.", "error");
      }
    } catch {
      showNotification(
        "Network error. Please check your connection and try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {hasToken ? "Set New Password" : "Forgot Password"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {hasToken
              ? "Enter your new password below."
              : "Enter your email and we will send you a reset link. If you do not see it, check your spam or junk folder."}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {!hasToken ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="Enter your email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  New Password
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  showPassword={showPassword}
                  onToggleShowPassword={() => setShowPassword(!showPassword)}
                  required
                />
                {password.length > 0 && (
                  <PasswordRequirements passwordValidation={passwordValidation} />
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Confirm New Password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  showPassword={showConfirmPassword}
                  onToggleShowPassword={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                {loading ? "Updating..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="text-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium transition-colors"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>

      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={() => setNotification({ ...notification, isVisible: false })}
      />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
