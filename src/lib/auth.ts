/**
 * Authentication utilities for password hashing and validation
 *
 * IMPORTANT SECURITY NOTES:
 * - Never store passwords in plain text
 * - Always hash passwords before storing in database
 * - Use bcrypt for password hashing (industry standard)
 * - Use salt rounds (12 is recommended for 2024)
 */

import bcrypt from "bcryptjs";

// Number of salt rounds for password hashing
// Higher = more secure but slower
// 12 rounds is recommended for 2024 (takes ~250ms to hash)
const SALT_ROUNDS = 12;

/**
 * Hash a plain text password
 * @param password - Plain text password from user input
 * @returns Promise<string> - Hashed password ready for database storage
 *
 * Example usage:
 * const hashedPassword = await hashPassword("mypassword123");
 * // Result: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J7..."
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // bcrypt.hash() generates a random salt and hashes the password
    // The result includes both the salt and the hash
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Failed to hash password");
  }
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password from user input
 * @param hashedPassword - Hashed password from database
 * @returns Promise<boolean> - True if passwords match, false otherwise
 *
 * Example usage:
 * const isValid = await comparePassword("mypassword123", storedHash);
 * if (isValid) {
 *   // User login successful
 * }
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    // bcrypt.compare() extracts the salt from the hashed password
    // and uses it to hash the plain text password, then compares
    const isValid = await bcrypt.compare(password, hashedPassword);
    return isValid;
  } catch (error) {
    console.error("Error comparing password:", error);
    return false;
  }
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
