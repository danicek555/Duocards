/**
 * API Route: POST /api/auth/register
 *
 * This endpoint handles user registration
 *
 * Flow:
 * 1. Validate input data (email, password, name)
 * 2. Check if user already exists
 * 3. Hash the password
 * 4. Create user in database
 * 5. Return success response
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isValidEmail, createAuthToken } from "@/lib/auth";
import { validatePassword } from "@/lib/passwordValidation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/emailVerification";
import { parseRequestLocale } from "@/lib/locale";
import { logEnvironmentStatus } from "@/lib/envValidation";

// Define the expected request body structure
interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
  locale?: string;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit(`register:ip:${clientIp}`, 20, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later.", code: "RATE_LIMIT_REGISTER" },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    // Validate environment variables
    const envValidation = logEnvironmentStatus();
    if (!envValidation.isValid) {
      console.error("Environment validation failed:", envValidation.errors);
      return NextResponse.json(
        {
          error: "Server configuration error. Please contact support.",
          code: "ENV_VALIDATION_FAILED",
        },
        { status: 500 }
      );
    }

    // Parse JSON from request body
    const body: RegisterRequest = await request.json();
    const { email, password, nickname, locale: rawLocale } = body;
    const locale = parseRequestLocale(rawLocale);

    // Validate input data
    if (!email || !password || !nickname) {
      return NextResponse.json(
        { error: "Email, password, and nickname are required", code: "REQUIRED_FIELDS" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format", code: "INVALID_EMAIL" },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.message, code: passwordValidation.strength === "weak" ? "PASSWORD_WEAK" : "PASSWORD_MEDIUM" },
        { status: 400 }
      );
    }

    // Check if user already exists or has pending registration
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists", code: "EMAIL_EXISTS" },
        { status: 409 } // 409 = Conflict
      );
    }

    // Hash the password before storing
    const hashedPassword = await hashPassword(password);

    // Email verification can be disabled explicitly via env flag.
    // Do not auto-disable in development.
    const skipEmailVerification =
      process.env.SKIP_EMAIL_VERIFICATION === "true";

    if (skipEmailVerification) {
      // Create user directly without email verification
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          nickname: nickname.trim(),
          locale,
          emailVerified: true, // Auto-verify in development
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          locale: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      // Create signed auth cookie (same as login)
      const token = await createAuthToken({
        userId: newUser.id,
        email: newUser.email,
      });
      const res = NextResponse.json(
        {
          message: "Registration successful!",
          user: newUser,
          requiresVerification: false,
        },
        { status: 201 } // 201 = Created
      );
      res.cookies.set("auth", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return res;
    }

    // Normal flow with email verification
    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Check if there's already a pending registration for this email
    const existingPending = await prisma.pendingRegistration.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingPending) {
      // Update existing pending registration
      await prisma.pendingRegistration.update({
        where: { id: existingPending.id },
        data: {
          password: hashedPassword,
          nickname: nickname.trim(),
          locale,
          verificationCode: verificationCode,
          verificationCodeExpires: verificationCodeExpires,
        },
      });
    } else {
      // Create new pending registration
      await prisma.pendingRegistration.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          nickname: nickname.trim(),
          locale,
          verificationCode: verificationCode,
          verificationCodeExpires: verificationCodeExpires,
        },
      });
    }

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationCode);

    if (!emailResult.success) {
      // If email sending fails, delete the pending registration and return specific error
      await prisma.pendingRegistration.delete({
        where: { email: email.toLowerCase() },
      });
      return NextResponse.json(
        {
          error:
            emailResult.error ||
            "Failed to send verification email. Please try again.",
        },
        { status: 400 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        message:
          "Registration successful! Please check your email for verification code.",
        email: email,
        requiresVerification: true,
      },
      { status: 201 } // 201 = Created
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);

    // Type guard for Prisma errors
    const isPrismaError = (
      err: unknown
    ): err is { code: string; meta?: unknown; message: string } => {
      return typeof err === "object" && err !== null && "code" in err;
    };

    // Type guard for standard errors
    const isStandardError = (err: unknown): err is Error => {
      return err instanceof Error;
    };

    // Handle specific error types with more detailed messages
    if (isPrismaError(error) && error.code === "P2021") {
      console.error("Database table not found:", error.meta);
      return NextResponse.json(
        {
          error: "Database configuration error. Please contact support.",
          code: "DB_TABLE_NOT_FOUND",
        },
        { status: 500 }
      );
    }

    if (isPrismaError(error) && error.code === "P2002") {
      return NextResponse.json(
        {
          error: "User with this email already exists",
          code: "EMAIL_EXISTS",
        },
        { status: 409 }
      );
    }

    if (isPrismaError(error) && error.code === "P1001") {
      console.error("Database connection failed:", error.message);
      return NextResponse.json(
        {
          error: "Database connection failed. Please try again later.",
          code: "DB_CONNECTION_FAILED",
        },
        { status: 503 }
      );
    }

    if (isStandardError(error) && error.name === "SyntaxError") {
      return NextResponse.json(
        {
          error: "Invalid request format",
          code: "INVALID_REQUEST_FORMAT",
        },
        { status: 400 }
      );
    }

    // Log detailed error info for debugging
    console.error("Detailed error info:", {
      name: isStandardError(error) ? error.name : "Unknown",
      code: isPrismaError(error) ? error.code : "Unknown",
      message: isStandardError(error) ? error.message : "Unknown error",
      stack: isStandardError(error)
        ? error.stack?.split("\n").slice(0, 3)
        : undefined,
    });

    // Return generic error message for unknown errors
    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        code: "UNKNOWN_ERROR",
        ...(process.env.NODE_ENV === "development" && {
          debug: isStandardError(error) ? error.message : "Unknown error",
        }),
      },
      { status: 500 }
    );
  }
}

/**
 * Security Notes:
 *
 * 1. Password Hashing:
 *    - We hash passwords with Argon2id before storing (most secure algorithm available)
 *    - Never store plain text passwords
 *    - We don't return the password in the response
 *
 * 2. Input Validation:
 *    - Validate email format
 *    - Check password strength
 *    - Trim whitespace from names
 *    - Store emails in lowercase for consistency
 *
 * 3. Error Handling:
 *    - Don't expose internal errors to client
 *    - Use appropriate HTTP status codes
 *    - Log errors for debugging
 *
 * 4. Database Operations:
 *    - Use Prisma's type-safe queries
 *    - Handle unique constraint violations
 *    - Use transactions for complex operations (if needed)
 */
