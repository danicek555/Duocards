/**
 * API Route: POST /api/auth/verify
 *
 * This endpoint handles email verification
 *
 * Flow:
 * 1. Validate input data (email, verification code)
 * 2. Find user by email
 * 3. Check if code matches and is not expired
 * 4. Mark user as verified
 * 5. Return success response
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/auth";
import {
  isValidVerificationCode,
  isVerificationCodeExpired,
} from "@/lib/emailVerification";

// Define the expected request body structure
interface VerifyRequest {
  email: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON from request body
    const body: VerifyRequest = await request.json();
    const { email, code } = body;

    // Validate input data
    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
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

    // Validate verification code format
    if (!isValidVerificationCode(code)) {
      return NextResponse.json(
        { error: "Invalid verification code format" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // If user doesn't exist, return error
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    // Check if verification code exists
    if (!user.verificationCode || !user.verificationCodeExpires) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if verification code matches
    if (user.verificationCode !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Check if verification code is expired
    if (isVerificationCodeExpired(user.verificationCodeExpires.getTime())) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Mark user as verified and clear verification code
    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Return success response
    return NextResponse.json(
      {
        message: "Email verified successfully!",
        user: verifiedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Verification error:", error);

    // Return generic error message
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
