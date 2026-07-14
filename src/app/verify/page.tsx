"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Notification from "@/components/Notification";
import Modal from "@/components/Modal";
import AuthBackground from "@/components/AuthBackground";
import AuthCard from "@/components/AuthCard";
import AuthFooter from "@/components/AuthFooter";
import AuthLoadingFallback from "@/components/AuthLoadingFallback";
import AuthPageHeader from "@/components/AuthPageHeader";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import { useI18n } from "@/i18n/I18nProvider";
import { translateApiError } from "@/i18n/translate";
import { isLocale } from "@/i18n/types";

function VerifyEmailContent() {
  const { locale, setLocale, t } = useI18n();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "warning" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showNotification = (
    message: string,
    type: "success" | "error" | "warning" | "info",
  ) => {
    setNotification({ message, type, isVisible: true });
  };

  const showModal = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info",
  ) => {
    setModal({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    const emailParam = searchParams.get("email");
    const storedEmail = localStorage.getItem("pendingVerificationEmail");

    if (emailParam) {
      setEmail(emailParam);
      localStorage.setItem("pendingVerificationEmail", emailParam);
    } else if (storedEmail) {
      setEmail(storedEmail);
    } else {
      router.push("/");
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [searchParams, router]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 6) {
      setCode(value);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      showNotification(t("verify.invalidCode"), "error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            code: code,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        localStorage.removeItem("pendingVerificationEmail");
        localStorage.removeItem("user");
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("rememberedEmail");

        localStorage.setItem("user", JSON.stringify(data.user));
        if (isLocale(data.user?.locale)) {
          setLocale(data.user.locale, { persist: true, sync: false });
        }

        showModal(t("verify.successTitle"), t("verify.successBody"), "success");

        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        showNotification(
          translateApiError(locale, data.code, data.error || t("verify.verifyFailed")),
          "error",
        );
      }
    } catch {
      showNotification(t("verify.networkError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/resend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showNotification(t("verify.resendSuccess"), "success");
        setTimeLeft(600);
      } else {
        showNotification(
          translateApiError(locale, data.code, data.error || t("verify.resendFailed")),
          "error",
        );
      }
    } catch {
      showNotification(t("verify.networkError"), "error");
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return <AuthLoadingFallback />;
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <AuthPageHeader badge={t("verify.badge")} subtitle={t("verify.subtitle")}>
          <p className="mt-1 font-medium text-blue-600 dark:text-blue-400">
            {email}
          </p>
        </AuthPageHeader>

        <AuthCard>
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label
                htmlFor="code"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("verify.codeLabel")}
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={handleCodeChange}
                maxLength={6}
                required
                className="w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-center font-mono text-2xl tracking-widest transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white"
                placeholder={t("verify.codePlaceholder")}
                autoComplete="one-time-code"
              />
              <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                {t("verify.codeHint")}
              </p>
            </div>

            {timeLeft > 0 && (
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("verify.expiresIn")}{" "}
                  <span className="font-mono text-red-600 dark:text-red-400">
                    {formatTime(timeLeft)}
                  </span>
                </p>
              </div>
            )}

            <AuthSubmitButton
              disabled={code.length !== 6}
              loading={loading}
              loadingText={t("verify.verifying")}
            >
              {t("verify.submit")}
            </AuthSubmitButton>

            <div className="text-center">
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                {t("verify.resendPrompt")}
              </p>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendLoading}
                className="font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {resendLoading ? t("verify.resending") : t("verify.resend")}
              </button>
            </div>

            <div className="border-t border-gray-200 pt-4 text-center dark:border-gray-600">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {t("verify.backToLogin")}
              </button>
            </div>
          </form>
        </AuthCard>

        <AuthFooter />
      </div>

      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={() => setNotification({ ...notification, isVisible: false })}
      />

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </AuthBackground>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
