/**
 * Email verification utilities
 * Simple email verification system for development
 */

/**
 * Generate a random verification code
 * @returns string - 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification email (mock implementation)
 * In production, you would integrate with an email service like:
 * - SendGrid
 * - AWS SES
 * - Nodemailer with SMTP
 * - Resend
 *
 * @param email - Email address to send verification to
 * @param code - Verification code
 * @returns Promise<boolean> - Success status
 */
export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<boolean> {
  // Mock implementation - in production, replace with real email service
  console.log(`📧 Verification email would be sent to: ${email}`);
  console.log(`🔐 Verification code: ${code}`);
  console.log(
    `📝 Email content: "Your DuoCards verification code is: ${code}"`
  );

  // Simulate email sending delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // For development, always return true
  // In production, handle actual email sending errors
  return true;
}

/**
 * Validate verification code format
 * @param code - Code to validate
 * @returns boolean - True if code format is valid
 */
export function isValidVerificationCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Check if verification code is expired
 * @param timestamp - When the code was generated
 * @param expiryMinutes - How many minutes the code is valid (default: 10)
 * @returns boolean - True if code is expired
 */
export function isVerificationCodeExpired(
  timestamp: number,
  expiryMinutes: number = 10
): boolean {
  const now = Date.now();
  const expiryTime = timestamp + expiryMinutes * 60 * 1000;
  return now > expiryTime;
}
