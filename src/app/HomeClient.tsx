"use client";

import { useState, useEffect } from "react";
import { validatePassword } from "@/lib/passwordValidation";
import Notification from "@/components/Notification";
import Modal from "@/components/Modal";
import AuthHeader from "@/components/AuthHeader";
import AuthToggle from "@/components/AuthToggle";
import PasswordInput from "@/components/PasswordInput";
import PasswordRequirements from "@/components/PasswordRequirements";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import AuthBackground from "@/components/AuthBackground";
import AuthCard from "@/components/AuthCard";
import AuthFooter from "@/components/AuthFooter";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import { LanguageSelect } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { translateApiError } from "@/i18n/translate";
import { isLocale, type Locale } from "@/i18n/types";
import { apiFetch, parseApiError } from "@/lib/apiUrl";

export default function HomeClient() {
  const { locale, setLocale, t } = useI18n();
  const [isLogin, setIsLogin] = useState(true);
  const [registerLocale, setRegisterLocale] = useState<Locale>(locale);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nickname: "",
  });
  const [passwordValidation, setPasswordValidation] = useState(
    validatePassword(""),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const showRememberMe = true;
  const showSocialLogin = true;
  const [rememberMe, setRememberMe] = useState(false);

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
    setRegisterLocale(locale);
  }, [locale]);

  useEffect(() => {
    setIsMounted(true);
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    const isRemembered = localStorage.getItem("rememberMe") === "true";

    if (rememberedEmail && isRemembered) {
      setFormData((prev) => ({ ...prev, email: rememberedEmail }));
      setRememberMe(true);
    }

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error");
    if (authError) {
      const message =
        t(`auth.oauthErrors.${authError}`) !== `auth.oauthErrors.${authError}`
          ? t(`auth.oauthErrors.${authError}`)
          : t("auth.oauthErrors.default");
      showNotification(message, "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [t]);

  const passwordsMatch =
    formData.password &&
    formData.confirmPassword &&
    formData.password === formData.confirmPassword;

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/google`;
  };

  const handleFacebookLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/facebook`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFormData = {
      ...formData,
      [e.target.name]: e.target.value,
    };
    setFormData(newFormData);

    if (e.target.name === "password") {
      setPasswordValidation(validatePassword(e.target.value));
    }
  };

  const applyUserLocale = (userLocale?: string) => {
    if (isLocale(userLocale)) {
      setLocale(userLocale, { persist: true, sync: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await apiFetch("/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem("user", JSON.stringify(data.user));
          applyUserLocale(data.user?.locale);

          if (rememberMe) {
            localStorage.setItem("rememberMe", "true");
            localStorage.setItem("rememberedEmail", formData.email);
          } else {
            localStorage.removeItem("rememberMe");
            localStorage.removeItem("rememberedEmail");
          }

          window.location.href = "/dashboard";
        } else {
          const apiError = parseApiError(data, t("auth.loginFailed"));
          showNotification(
            translateApiError(locale, apiError.code, apiError.message),
            "error",
          );
        }
      } else {
        if (!passwordValidation.isValid) {
          showModal(
            t("auth.passwordRequirementsTitle"),
            t("auth.passwordRequirementsBody"),
            "warning",
          );
          return;
        }

        if (!passwordsMatch) {
          showNotification(t("auth.passwordsNoMatch"), "error");
          return;
        }

        setLocale(registerLocale, { persist: true, sync: false });

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              nickname: formData.nickname,
              locale: registerLocale,
            }),
          },
        );

        const data = await response.json();

        if (response.ok) {
          if (data.requiresVerification) {
            localStorage.setItem("pendingVerificationEmail", formData.email);
            window.location.href = `/verify?email=${encodeURIComponent(
              formData.email,
            )}`;
          } else {
            localStorage.removeItem("user");
            localStorage.removeItem("rememberMe");
            localStorage.removeItem("rememberedEmail");
            localStorage.setItem("user", JSON.stringify(data.user));
            applyUserLocale(data.user?.locale);
            window.location.href = "/dashboard";
          }
        } else {
          const apiError = parseApiError(data, t("auth.registerFailed"));
          showNotification(
            translateApiError(locale, apiError.code, apiError.message),
            "error",
          );
        }
      }
    } catch {
      showNotification(t("auth.networkError"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <AuthHeader isLogin={isLogin} />

        <AuthCard>
          <AuthToggle isLogin={isLogin} onToggle={setIsLogin} />

          {!isMounted ? (
            <div className="space-y-4">
              <div className="h-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="h-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="h-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              suppressHydrationWarning
            >
              {!isLogin && (
                <div>
                  <label
                    htmlFor="nickname"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t("auth.nickname")}
                  </label>
                  <input
                    type="text"
                    id="nickname"
                    name="nickname"
                    value={formData.nickname}
                    onChange={handleInputChange}
                    required={!isLogin}
                    className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white"
                    placeholder={t("auth.nicknamePlaceholder")}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("auth.email")}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white"
                  placeholder={t("auth.emailPlaceholder")}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("auth.password")}
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={t("auth.passwordPlaceholder")}
                  showPassword={showPassword}
                  onToggleShowPassword={() => setShowPassword(!showPassword)}
                  required
                />

                {!isLogin && formData.password && (
                  <PasswordRequirements
                    passwordValidation={passwordValidation}
                  />
                )}
              </div>

              {!isLogin && (
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t("auth.confirmPassword")}
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    showPassword={showConfirmPassword}
                    onToggleShowPassword={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    required={!isLogin}
                    className={
                      formData.confirmPassword && formData.password
                        ? passwordsMatch
                          ? "border-green-500 dark:border-green-500"
                          : "border-red-500 dark:border-red-500"
                        : ""
                    }
                  />

                  {formData.confirmPassword && formData.password && (
                    <div className="mt-2 flex items-center text-sm">
                      <span
                        className={`mr-2 ${
                          passwordsMatch ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {passwordsMatch ? "✓" : "✗"}
                      </span>
                      <span
                        className={
                          passwordsMatch ? "text-green-600" : "text-red-600"
                        }
                      >
                        {passwordsMatch
                          ? t("auth.passwordsMatch")
                          : t("auth.passwordsNoMatch")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!isLogin && (
                <LanguageSelect
                  value={registerLocale}
                  onChange={setRegisterLocale}
                />
              )}

              {isLogin && showRememberMe && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => {
                        setRememberMe(e.target.checked);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      {t("auth.rememberMe")}
                    </span>
                  </label>
                  <a
                    href="/reset-password"
                    className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {t("auth.forgotPassword")}
                  </a>
                </div>
              )}

              <AuthSubmitButton
                disabled={isLoading}
                loading={isLoading}
                loadingText={
                  isLogin ? t("auth.signingIn") : t("auth.creatingAccount")
                }
              >
                {isLogin ? t("auth.signIn") : t("auth.createAccount")}
              </AuthSubmitButton>
            </form>
          )}

          {showSocialLogin && (
            <SocialLoginButtons
              onGoogleLogin={handleGoogleLogin}
              onFacebookLogin={handleFacebookLogin}
            />
          )}
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
