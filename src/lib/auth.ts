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
export function comparePassword(password: string, hashedPassword: string): boolean {
  // This is NOT secure - only for testing
  // In production, use bcrypt.compare()
  return btoa(password) === hashedPassword;
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns boolean - True if email format is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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