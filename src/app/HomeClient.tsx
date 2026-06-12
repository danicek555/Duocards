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

export default function HomeClient() {
  const [isLogin, setIsLogin] = useState(true);
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

  // Feature flags - set to true to show these features
  const showRememberMe = true;
  const showSocialLogin = true;
  const [rememberMe, setRememberMe] = useState(false);

  // Notification and Modal states
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

  // Helper functions for notifications and modals
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

  // Handle client-side mounting to prevent hydration mismatches
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
      const messages: Record<string, string> = {
        google_not_configured:
          "Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.",
        google_auth_failed: "Google sign-in failed. Please try again.",
        google_auth_cancelled: "Google sign-in was cancelled.",
        google_email_not_verified:
          "Your Google account email is not verified. Please verify it and try again.",
        facebook_not_configured:
          "Facebook sign-in is not configured yet. Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to your environment.",
        facebook_auth_failed: "Facebook sign-in failed. Please try again.",
        facebook_auth_cancelled: "Facebook sign-in was cancelled.",
        facebook_email_not_available:
          "Facebook did not share an email address. Use email sign-in or allow email access on Facebook.",
        facebook_email_scope_not_enabled:
          "Facebook email permission is not enabled for your app. In Meta Developer Console go to Use cases → Authentication and account creation → Permissions, and add email (Ready for testing).",
      };
      showNotification(
        messages[authError] || "Sign-in failed. Please try again.",
        "error",
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Check if passwords match
  const passwordsMatch =
    formData.password &&
    formData.confirmPassword &&
    formData.password === formData.confirmPassword;

  // Social login handlers
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

    // Validate password in real-time when password field changes
    if (e.target.name === "password") {
      setPasswordValidation(validatePassword(e.target.value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Set loading state
    setIsLoading(true);

    try {
      if (isLogin) {
        // Handle login
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
            }),
          },
        );

        const data = await response.json();

        if (response.ok) {
          // Login successful
          console.log("Login successful:", data);

          // Store user data in localStorage
          localStorage.setItem("user", JSON.stringify(data.user));

          // Handle Remember Me functionality
          if (rememberMe) {
            localStorage.setItem("rememberMe", "true");
            localStorage.setItem("rememberedEmail", formData.email);
          } else {
            localStorage.removeItem("rememberMe");
            localStorage.removeItem("rememberedEmail");
          }

          // Redirect to dashboard
          window.location.href = "/dashboard";
        } else {
          // Login failed
          console.error("Login failed:", data.error);
          showNotification(data.error || "Login failed", "error");
        }
      } else {
        // Handle registration
        // Check password strength
        if (!passwordValidation.isValid) {
          showModal(
            "Password Requirements Not Met",
            "Your password doesn't meet the security requirements. Please check the requirements below and try again.",
            "warning",
          );
          return;
        }

        // Check if passwords match
        if (!passwordsMatch) {
          showNotification(
            "Passwords do not match. Please check your password confirmation.",
            "error",
          );
          return;
        }

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
            }),
          },
        );

        const data = await response.json();

        if (response.ok) {
          // Registration successful
          console.log("Registration successful:", data);

          if (data.requiresVerification) {
            // Store email for verification
            localStorage.setItem("pendingVerificationEmail", formData.email);

            // Redirect to verification page
            window.location.href = `/verify?email=${encodeURIComponent(
              formData.email,
            )}`;
          } else {
            // Clear any old user data first
            localStorage.removeItem("user");
            localStorage.removeItem("rememberMe");
            localStorage.removeItem("rememberedEmail");

            // Store new user data in localStorage
            localStorage.setItem("user", JSON.stringify(data.user));

            // Redirect to dashboard
            window.location.href = "/dashboard";
          }
        } else {
          // Registration failed - show user-friendly error without console logging
          showNotification(data.error || "Registration failed", "error");
        }
      }
    } catch {
      // Network error - show user-friendly message without console logging
      showNotification(
        "Network error. Please check your connection and try again.",
        "error",
      );
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <AuthHeader isLogin={isLogin} />

        {/* Auth Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Toggle Buttons */}
          <AuthToggle isLogin={isLogin} onToggle={setIsLogin} />

          {/* Form */}
          {!isMounted ? (
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
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
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Nickname
                  </label>
                  <input
                    type="text"
                    id="nickname"
                    name="nickname"
                    value={formData.nickname}
                    onChange={handleInputChange}
                    required={!isLogin}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                    placeholder="Choose a nickname"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Password
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  showPassword={showPassword}
                  onToggleShowPassword={() => setShowPassword(!showPassword)}
                  required
                />

                {/* Password Requirements - Only show during registration */}
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
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Confirm Password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
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

                  {/* Password Match Indicator */}
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
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </span>
                    </div>
                  )}
                </div>
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
                      Remember me
                    </span>
                  </label>
                  <a
                    href="/reset-password"
                    className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Forgot password?
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                  isLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-blue-700"
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </span>
                ) : isLogin ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}

          {/* Social Login */}
          {showSocialLogin && (
            <SocialLoginButtons
              onGoogleLogin={handleGoogleLogin}
              onFacebookLogin={handleFacebookLogin}
            />
          )}
        </div>
      </div>

      {/* Custom Notification */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={() => setNotification({ ...notification, isVisible: false })}
      />

      {/* Custom Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
