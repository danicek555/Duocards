"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    type: "success" | "error" | "warning" | "info",
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
        },
      );

      const data = await response.json();
      if (response.ok) {
        showNotification(
          data.message ||
            "Pokud účet existuje, poslali jsme odkaz na reset. Zkontroluj i spam.",
          "success",
        );
      } else {
        showNotification(
          data.error || "Nepodařilo se odeslat email.",
          "error",
        );
      }
    } catch {
      showNotification(
        "Chyba sítě. Zkontroluj připojení a zkus to znovu.",
        "error",
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
      showNotification("Hesla se neshodují.", "error");
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
        },
      );

      const data = await response.json();
      if (response.ok) {
        showNotification(
          "Heslo změněno. Přesměrovávám na přihlášení...",
          "success",
        );
        setTimeout(() => router.push("/"), 1500);
      } else {
        showNotification(
          data.error || "Nepodařilo se změnit heslo.",
          "error",
        );
      }
    } catch {
      showNotification(
        "Chyba sítě. Zkontroluj připojení a zkus to znovu.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <AuthPageHeader
          badge={hasToken ? "NOVÉ HESLO" : "ZAPOMENUTÉ HESLO"}
          subtitle={
            hasToken
              ? "Zadej nové heslo pro svůj účet."
              : "Zadej email a pošleme ti odkaz na reset. Zkontroluj i spam."
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
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white"
                  placeholder="tvuj@email.cz"
                />
              </div>

              <AuthSubmitButton loading={loading} loadingText="Odesílám...">
                Poslat odkaz →
              </AuthSubmitButton>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Nové heslo
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tvoje nové heslo"
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
                  Potvrzení hesla
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Zopakuj heslo"
                  showPassword={showConfirmPassword}
                  onToggleShowPassword={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  required
                />
              </div>

              <AuthSubmitButton loading={loading} loadingText="Ukládám...">
                Změnit heslo →
              </AuthSubmitButton>
            </form>
          )}

          <div className="mt-4 border-t border-gray-200 pt-4 text-center dark:border-gray-600">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Zpět na přihlášení
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
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
