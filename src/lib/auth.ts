/**
 * Authentication utilities for password validation
 *
 * NOTE: This is a simplified version without bcrypt for testing
 * In production, you should use proper password hashing
 */

/**
 * Simple password hashing (NOT SECURE - for testing only)
 * @param password - Plain text password from user input
 * @returns string - Simple hash (NOT SECURE)
 */
export function hashPassword(password: string): string {
  // This is NOT secure - only for testing
  // In production, use bcrypt or similar
  return btoa(password); // Base64 encoding (NOT SECURE)
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password from user input
 * @param hashedPassword - Hashed password from database
 * @returns boolean - True if passwords match, false otherwise
 */
export function comparePassword(
  password: string,
  hashedPassword: string
): boolean {
  // This is NOT secure - only for testing
  // In production, use bcrypt.compare()
  return btoa(password) === hashedPassword;
}

/**
 * Validate email format with enhanced security
 * @param email - Email address to validate
 * @returns boolean - True if email format is valid
 */
export function isValidEmail(email: string): boolean {
  // More strict email validation
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Basic format check
  if (!emailRegex.test(email)) {
    return false;
  }

  // Additional security checks
  const parts = email.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;

  // Local part validation
  if (localPart.length === 0 || localPart.length > 64) {
    return false;
  }

  // Domain validation
  if (domain.length === 0 || domain.length > 253) {
    return false;
  }

  // Check for valid domain structure
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return false;
  }

  // Each domain part should be valid
  for (const part of domainParts) {
    if (part.length === 0 || part.length > 63) {
      return false;
    }
    // Domain parts should only contain letters, numbers, and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(part)) {
      return false;
    }
    // Cannot start or end with hyphen
    if (part.startsWith("-") || part.endsWith("-")) {
      return false;
    }
  }

  // Top-level domain should be at least 2 characters
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns object with validation result and message
 */
export function validatePassword(password: string): {
  isValid: boolean;
  message: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (!/(?=.*[a-z])/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }

  if (!/(?=.*\d)/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one number",
    };
  }

  return { isValid: true, message: "Password is valid" };
}
