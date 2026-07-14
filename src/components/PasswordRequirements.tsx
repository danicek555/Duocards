"use client";

import {
  getPasswordStrengthColor,
  getPasswordStrengthProgress,
} from "@/lib/passwordValidation";
import { useI18n } from "@/i18n/I18nProvider";

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
  const { t } = useI18n();

  return (
    <div className="mt-3 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("password.title")}
        </span>
        <span
          className={`rounded-full border px-2 py-1 text-xs ${getPasswordStrengthColor(
            passwordValidation.strength,
          )}`}
        >
          {t(`password.${passwordValidation.strength}`)}
        </span>
      </div>

      <div className="mb-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-600">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            passwordValidation.strength === "weak"
              ? "bg-red-500"
              : passwordValidation.strength === "medium"
                ? "bg-yellow-500"
                : "bg-green-500"
          }`}
          style={{
            width: `${getPasswordStrengthProgress(passwordValidation.strength)}%`,
          }}
        />
      </div>

      <div className="space-y-1">
        {(
          [
            ["minLength", passwordValidation.requirements.minLength],
            ["uppercase", passwordValidation.requirements.hasUppercase],
            ["lowercase", passwordValidation.requirements.hasLowercase],
            ["numbers", passwordValidation.requirements.hasNumbers],
            ["special", passwordValidation.requirements.hasSpecialChars],
          ] as const
        ).map(([key, met]) => (
          <div key={key} className="flex items-center text-sm">
            <span className={`mr-2 ${met ? "text-green-600" : "text-gray-400"}`}>
              {met ? "✓" : "✗"}
            </span>
            <span
              className={
                met
                  ? "text-green-600"
                  : "text-gray-600 dark:text-gray-400"
              }
            >
              {t(`password.${key}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
