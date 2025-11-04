/**
 * Password validation utilities
 * Validates password strength based on common security requirements
 */

export interface PasswordValidation {
  isValid: boolean;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
  };
  strength: "weak" | "medium" | "strong";
  message: string;
}

/**
 * Validates password strength and returns detailed validation results
 * @param password - The password to validate
 * @returns PasswordValidation object with validation results
 */
export function validatePassword(password: string): PasswordValidation {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const validCount = Object.values(requirements).filter(Boolean).length;
  const isValid = validCount === 5;

  let strength: "weak" | "medium" | "strong";
  let message: string;

  if (validCount < 3) {
    strength = "weak";
    message = "Password is too weak";
  } else if (validCount < 5) {
    strength = "medium";
    message = "Password is moderately strong";
  } else {
    strength = "strong";
    message = "Password is strong";
  }

  return {
    isValid,
    requirements,
    strength,
    message,
  };
}

/**
 * Get password strength color for UI
 * @param strength - Password strength level
 * @returns Tailwind CSS color classes
 */
export function getPasswordStrengthColor(
  strength: "weak" | "medium" | "strong"
): string {
  switch (strength) {
    case "weak":
      return "text-red-600 bg-red-50 border-red-200";
    case "medium":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "strong":
      return "text-green-600 bg-green-50 border-green-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

/**
 * Get password strength progress percentage
 * @param strength - Password strength level
 * @returns Progress percentage (0-100)
 */
export function getPasswordStrengthProgress(
  strength: "weak" | "medium" | "strong"
): number {
  switch (strength) {
    case "weak":
      return 33;
    case "medium":
      return 66;
    case "strong":
      return 100;
    default:
      return 0;
  }
}










