"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Notification from "@/components/Notification";
import PasswordInput from "@/components/PasswordInput";
import PasswordRequirements from "@/components/PasswordRequirements";
import { validatePassword } from "@/lib/passwordValidation";
import AuthBackground from "@/components/AuthBackground";
import AuthCard from "@/components/AuthCard";
import AuthFooter from "@/components/AuthFooter";
import AuthLoadingFallback from "@/components/AuthLoadingFallback";
import AuthPageHeader from "@/components/AuthPageHeader";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import { useI18n } from "@/i18n/I18nProvider";
import { translateApiError } from "@/i18n/translate";
import { apiFetch, parseApiError } from "@/lib/apiUrl";
import { redactSensitiveUrl } from "@/lib/sentryPrivacy";

function ResetPasswordContent() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const didCaptureToken = useRef(false);
  const redirectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resetCompleted, setResetCompleted] = useState(false);

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

  useEffect(() => {
    // Keep the secret only in component memory and remove it from browser history
    // before the user can continue through the reset flow.
    if (!didCaptureToken.current) {
      didCaptureToken.current = true;

      const currentUrl = new URL(window.location.href);
      const fragmentParams = new URLSearchParams(currentUrl.hash.slice(1));
      const capturedToken =
        fragmentParams.get("token")?.trim() ||
        currentUrl.searchParams.get("token")?.trim() ||
        "";

      setToken(capturedToken);

      const redactedUrl = new URL(redactSensitiveUrl(currentUrl.href));
      window.history.replaceState(
        window.history.state,
        "",
        `${redactedUrl.pathname}${redactedUrl.search}${redactedUrl.hash}`,
      );
    }

    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current);
      }
    };
  }, []);

  if (token === null) return <AuthLoadingFallback />;

  const hasToken = token.length > 0 || resetCompleted;

  const passwordValidation = validatePassword(password);
  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const showNotification = (
    message: string,
    type: "success" | "error" | "warning" | "info",
  ) => {
    setNotification({ message, type, isVisible: true });
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        showNotification(data.message || t("resetPassword.sendSuccess"), "success");
      } else {
        const apiError = parseApiError(data, t("resetPassword.sendFailed"));
        showNotification(
          translateApiError(locale, apiError.code, apiError.message),
          "error",
        );
      }
    } catch {
      showNotification(t("resetPassword.networkError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.isValid) {
      showNotification(
        t(`errors.${passwordValidation.strength === "weak" ? "PASSWORD_WEAK" : "PASSWORD_MEDIUM"}`),
        "warning",
      );
      return;
    }

    if (!passwordsMatch) {
      showNotification(t("resetPassword.passwordsNoMatch"), "error");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      if (response.ok) {
        setToken("");
        setPassword("");
        setConfirmPassword("");
        setResetCompleted(true);
        showNotification(t("resetPassword.resetSuccess"), "success");
        redirectTimeout.current = setTimeout(() => router.push("/"), 1500);
      } else {
        const apiError = parseApiError(data, t("resetPassword.resetFailed"));
        showNotification(
          translateApiError(locale, apiError.code, apiError.message),
          "error",
        );
      }
    } catch {
      showNotification(t("resetPassword.networkError"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <AuthPageHeader
          badge={hasToken ? t("resetPassword.badgeNew") : t("resetPassword.badgeForgot")}
          subtitle={
            hasToken
              ? t("resetPassword.subtitleNew")
              : t("resetPassword.subtitleForgot")
          }
        />

        <AuthCard>
          {!hasToken ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("resetPassword.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white"
                  placeholder={t("resetPassword.emailPlaceholder")}
                />
              </div>

              <AuthSubmitButton loading={loading} loadingText={t("resetPassword.sending")}>
                {t("resetPassword.sendLink")}
              </AuthSubmitButton>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("resetPassword.newPassword")}
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("resetPassword.newPasswordPlaceholder")}
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
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("resetPassword.confirmPassword")}
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                  showPassword={showConfirmPassword}
                  onToggleShowPassword={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  required
                />
              </div>

              <AuthSubmitButton loading={loading} loadingText={t("resetPassword.saving")}>
                {t("resetPassword.reset")}
              </AuthSubmitButton>
            </form>
          )}

          <div className="mt-4 border-t border-gray-200 pt-4 text-center dark:border-gray-600">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t("resetPassword.backToLogin")}
            </button>
          </div>
        </AuthCard>

        <AuthFooter />
      </div>

      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={() => setNotification({ ...notification, isVisible: false })}
      />
    </AuthBackground>
  );
}

export default function ResetPasswordPage() {
  return <ResetPasswordContent />;
}
