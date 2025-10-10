/**
 * Email verification utilities
 * Real email verification system using Resend
 */

import { Resend } from "resend";

/**
 * Generate a random verification code
 * @returns string - 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification email using Resend
 *
 * @param email - Email address to send verification to
 * @param code - Verification code
 * @returns Promise<boolean> - Success status
 */
export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    // Initialize Resend with API key
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY is not configured");
      return false;
    }

    // Send verification email
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || "DuoCards <onboarding@resend.dev>",
      to: [email],
      subject: "Verify your DuoCards account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">DuoCards</h1>
            <p style="color: #666; margin: 5px 0;">Your language learning companion</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center;">
            <h2 style="color: #333; margin: 0 0 20px 0;">Verify Your Email Address</h2>
            <p style="color: #666; margin: 0 0 30px 0; line-height: 1.5;">
              Thank you for signing up for DuoCards! To complete your registration, 
              please use the verification code below:
            </p>
            
            <div style="background: #fff; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                ${code}
              </span>
            </div>
            
            <p style="color: #666; margin: 20px 0 0 0; font-size: 14px;">
              This code will expire in 10 minutes.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              If you didn't create an account with DuoCards, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `
        DuoCards - Verify Your Email Address
        
        Thank you for signing up for DuoCards! To complete your registration, 
        please use the verification code below:
        
        ${code}
        
        This code will expire in 10 minutes.
        
        If you didn't create an account with DuoCards, you can safely ignore this email.
      `,
    });

    if (error) {
      console.error("❌ Failed to send verification email:", error);
      return false;
    }

    console.log("✅ Verification email sent successfully:", data?.id);
    return true;
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    return false;
  }
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
