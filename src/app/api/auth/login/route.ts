/**
 * API Route: POST /api/auth/login
 *
 * This endpoint handles user login
 *
 * Flow:
 * 1. Validate input data (email, password)
 * 2. Find user by email
 * 3. Compare password with stored hash
 * 4. Return user data if successful
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, isValidEmail, createAuthToken } from "@/lib/auth";
import { authCookieOptions, authTokenTtlSeconds } from "@/lib/authSession";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Define the expected request body structure
interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit(`login:ip:${clientIp}`, 40, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later.", code: "RATE_LIMIT_LOGIN" },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
        },
      );
    }

    // Parse JSON from request body
    const body: LoginRequest = await request.json();
    const { email, password } = body;
    const rememberMe = body.rememberMe === true;

    // Validate input data
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required", code: "REQUIRED_EMAIL_PASSWORD" },
        { status: 400 },
      );
    }

    if (
      body.rememberMe !== undefined &&
      typeof body.rememberMe !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Remember me must be a boolean", code: "INVALID_REMEMBER_ME" },
        { status: 400 },
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format", code: "INVALID_EMAIL" },
        { status: 400 },
      );
    }

    // Find user by email (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        nickname: true,
        locale: true,
        createdAt: true,
      },
    });

    // If user doesn't exist, return error (don't reveal if email exists)
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        { status: 401 }, // 401 = Unauthorized
      );
    }

    // Compare provided password with stored hash
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    // Create signed auth cookie
    // Bind the cookie to the exact hash that was just verified. If a password
    // reset wins the race before this cookie is used, credential-version
    // validation rejects it instead of granting the old password a new session.
    const token = await createAuthToken(
      { userId: user.id, email: user.email },
      user.password,
      authTokenTtlSeconds(rememberMe),
    );
    const res = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          locale: user.locale,
          createdAt: user.createdAt,
        },
      },
      { status: 200 },
    );
    res.cookies.set("auth", token, authCookieOptions(rememberMe));
    return res;
  } catch (error: unknown) {
    console.error("Login error:", error);

    // Type guard for Prisma errors
    const isPrismaError = (
      err: unknown,
    ): err is { code: string; meta?: unknown; message: string } => {
      return typeof err === "object" && err !== null && "code" in err;
    };

    // Type guard for standard errors
    const isStandardError = (err: unknown): err is Error => {
      return err instanceof Error;
    };

    // Handle specific error types
    if (isPrismaError(error) && error.code === "P2021") {
      console.error("Database table not found:", error.meta);
      return NextResponse.json(
        {
          error: "Database configuration error. Please contact support.",
          code: "DB_TABLE_NOT_FOUND",
        },
        { status: 500 },
      );
    }

    if (isPrismaError(error) && error.code === "P1001") {
      console.error("Database connection failed:", error.message);
      return NextResponse.json(
        {
          error: "Database connection failed. Please try again later.",
          code: "DB_CONNECTION_FAILED",
        },
        { status: 503 },
      );
    }

    if (isStandardError(error) && error.name === "SyntaxError") {
      return NextResponse.json(
        {
          error: "Invalid request format",
          code: "INVALID_REQUEST_FORMAT",
        },
        { status: 400 },
      );
    }

    // Log detailed error info for debugging
    console.error("Detailed login error info:", {
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
      { status: 500 },
    );
  }
}

/**
 * Security Notes:
 *
 * 1. Password Verification:
 *    - We use Argon2id to verify passwords (most secure algorithm available)
 *    - This is secure against timing attacks, GPU attacks, and side-channel attacks
 *    - Never compare passwords directly
 *
 * 2. Error Messages:
 *    - Use generic error messages ("Invalid email or password")
 *    - Don't reveal if email exists or not
 *    - This prevents email enumeration attacks
 *
 * 3. Response Data:
 *    - Never return password in response
 *    - Only return necessary user data
 *    - Consider adding JWT tokens for session management
 *
 * 4. Rate Limiting:
 *    - Consider adding rate limiting to prevent brute force attacks
 *    - You can use libraries like 'express-rate-limit' or similar
 *
 * 5. Session Management:
 *    - This example doesn't include session management
 *    - In production, you'd typically:
 *      - Generate JWT tokens
 *      - Set HTTP-only cookies
 *      - Implement refresh tokens
 */
