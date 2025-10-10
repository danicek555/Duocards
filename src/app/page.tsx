"use client";

import { useState } from "react";
import {
  validatePassword,
  getPasswordStrengthColor,
  getPasswordStrengthProgress,
} from "@/lib/passwordValidation";
import Notification from "@/components/Notification";
import Modal from "@/components/Modal";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nickname: "",
  });
  const [passwordValidation, setPasswordValidation] = useState(
    validatePassword("")
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Check if passwords match
  const passwordsMatch =
    formData.password &&
    formData.confirmPassword &&
    formData.password === formData.confirmPassword;

  // Helper functions for notifications and modals
  const showNotification = (
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => {
    setNotification({ message, type, isVisible: true });
  };

  const showModal = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info"
  ) => {
    setModal({ isOpen: true, title, message, type });
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

    // Show loading state (you can add a loading spinner here)
    console.log("Submitting form...");

    try {
      if (isLogin) {
        // Handle login
        const response = await fetch("/api/auth/login", {
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
          // Login successful
          console.log("Login successful:", data);

          // Store user data in localStorage
          localStorage.setItem("user", JSON.stringify(data.user));

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
            "warning"
          );
          return;
        }

        // Check if passwords match
        if (!passwordsMatch) {
          showNotification(
            "Passwords do not match. Please check your password confirmation.",
            "error"
          );
          return;
        }

        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            nickname: formData.nickname,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // Registration successful
          console.log("Registration successful:", data);

          if (data.requiresVerification) {
            // Store email for verification
            localStorage.setItem("pendingVerificationEmail", formData.email);

            // Redirect to verification page
            window.location.href = `/verify?email=${encodeURIComponent(
              formData.email
            )}`;
          } else {
            // Store user data in localStorage
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
        "error"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            DuoCards
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isLogin ? "Welcome back!" : "Create your account"}
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Toggle Buttons */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isLogin
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isLogin
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password Requirements - Only show during registration */}
              {!isLogin && formData.password && (
                <div className="mt-3 p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Password Requirements:
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${getPasswordStrengthColor(
                        passwordValidation.strength
                      )}`}
                    >
                      {passwordValidation.strength}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-3">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordValidation.strength === "weak"
                          ? "bg-red-500"
                          : passwordValidation.strength === "medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${getPasswordStrengthProgress(
                          passwordValidation.strength
                        )}%`,
                      }}
                    ></div>
                  </div>

                  {/* Requirements checklist */}
                  <div className="space-y-1">
                    <div className="flex items-center text-sm">
                      <span
                        className={`mr-2 ${
                          passwordValidation.requirements.minLength
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {passwordValidation.requirements.minLength ? "✓" : "✗"}
                      </span>
                      <span
                        className={
                          passwordValidation.requirements.minLength
                            ? "text-green-600"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        at least 8 characters long
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span
                        className={`mr-2 ${
                          passwordValidation.requirements.hasUppercase
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {passwordValidation.requirements.hasUppercase
                          ? "✓"
                          : "✗"}
                      </span>
                      <span
                        className={
                          passwordValidation.requirements.hasUppercase
                            ? "text-green-600"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        contains uppercase letters (A-Z)
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span
                        className={`mr-2 ${
                          passwordValidation.requirements.hasLowercase
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {passwordValidation.requirements.hasLowercase
                          ? "✓"
                          : "✗"}
                      </span>
                      <span
                        className={
                          passwordValidation.requirements.hasLowercase
                            ? "text-green-600"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        contains lowercase letters (a-z)
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span
                        className={`mr-2 ${
                          passwordValidation.requirements.hasNumbers
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {passwordValidation.requirements.hasNumbers ? "✓" : "✗"}
                      </span>
                      <span
                        className={
                          passwordValidation.requirements.hasNumbers
                            ? "text-green-600"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        contains numbers (0-9)
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span
                        className={`mr-2 ${
                          passwordValidation.requirements.hasSpecialChars
                            ? "text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {passwordValidation.requirements.hasSpecialChars
                          ? "✓"
                          : "✗"}
                      </span>
                      <span
                        className={
                          passwordValidation.requirements.hasSpecialChars
                            ? "text-green-600"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        contains special characters (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                </div>
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
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required={!isLogin}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors ${
                      formData.confirmPassword && formData.password
                        ? passwordsMatch
                          ? "border-green-500 dark:border-green-500"
                          : "border-red-500 dark:border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

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

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    Remember me
                  </span>
                </label>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="ml-2">Google</span>
              </button>

              <button className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span className="ml-2">Facebook</span>
              </button>
            </div>
          </div>
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
