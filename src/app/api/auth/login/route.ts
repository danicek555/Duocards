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
import { comparePassword, isValidEmail } from "@/lib/auth";

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
    });

    // If user doesn't exist, return error (don't reveal if email exists)
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" }, // Generic message for security
        { status: 401 } // 401 = Unauthorized
      );
    }

    // Compare provided password with stored hash
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" }, // Generic message for security
        { status: 401 }
      );
    }

    // Login successful - return user data (without password)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };

    return NextResponse.json(
      {
        message: "Login successful",
        user: userData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);

    // Return generic error message
    return NextResponse.json(
      { error: "Internal server error" },
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
