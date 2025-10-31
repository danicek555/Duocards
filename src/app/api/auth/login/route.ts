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

// Define the expected request body structure
interface LoginRequest {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON from request body
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validate input data
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
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
        createdAt: true,
      },
    });

    // If user doesn't exist, return error (don't reveal if email exists)
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" }, // Generic message for security
        { status: 401 } // 401 = Unauthorized
      );
    }

    // Compare provided password with stored hash
    const isPasswordValid = comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" }, // Generic message for security
        { status: 401 }
      );
    }

    // Create signed auth cookie
    const token = await createAuthToken({ userId: user.id, email: user.email });
    const res = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          createdAt: user.createdAt,
        },
      },
      { status: 200 }
    );
    res.cookies.set("auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch (error: unknown) {
    console.error("Login error:", error);

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

    // Handle specific error types
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
      { status: 500 }
    );
  }
}

/**
 * Security Notes:
 *
 * 1. Password Verification:
 *    - We use bcrypt.compare() to verify passwords
 *    - This is secure against timing attacks
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
