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

    // Find pending registration by email
    const pendingRegistration = await prisma.pendingRegistration.findUnique({
      where: { email: email.toLowerCase() },
    });

    // If pending registration doesn't exist, return error
    if (!pendingRegistration) {
      return NextResponse.json(
        {
          error:
            "No pending registration found for this email. Please register first.",
        },
        { status: 404 }
      );
    }

    // Check if verification code matches
    if (pendingRegistration.verificationCode !== code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Check if verification code is expired
    if (
      isVerificationCodeExpired(
        pendingRegistration.verificationCodeExpires.getTime()
      )
    ) {
      // Clean up expired pending registration
      await prisma.pendingRegistration.delete({
        where: { email: email.toLowerCase() },
      });
      return NextResponse.json(
        { error: "Verification code has expired. Please register again." },
        { status: 400 }
      );
    }

    // Check if user already exists (race condition check)
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    if (existingUser) {
      // Delete pending registration since user already exists
      await prisma.pendingRegistration.delete({
        where: { email: email.toLowerCase() },
      });
      return NextResponse.json(
        { error: "User already exists. Please login." },
        { status: 400 }
      );
    }

    // Create the user and delete pending registration
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: pendingRegistration.password,
        nickname: pendingRegistration.nickname,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Delete the pending registration
    await prisma.pendingRegistration.delete({
      where: { email: email.toLowerCase() },
    });

    const verifiedUser = newUser;

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

