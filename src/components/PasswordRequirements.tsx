"use client";

import {
  getPasswordStrengthColor,
  getPasswordStrengthProgress,
} from "@/lib/passwordValidation";

interface PasswordValidation {
  isValid: boolean;
  strength: "weak" | "medium" | "strong";
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
  };
}

interface PasswordRequirementsProps {
  passwordValidation: PasswordValidation;
}

export default function PasswordRequirements({
  passwordValidation,
}: PasswordRequirementsProps) {
  return (
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
            {passwordValidation.requirements.hasUppercase ? "✓" : "✗"}
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
            {passwordValidation.requirements.hasLowercase ? "✓" : "✗"}
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
            {passwordValidation.requirements.hasSpecialChars ? "✓" : "✗"}
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
  );
}
