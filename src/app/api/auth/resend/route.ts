/**
 * API Route: POST /api/auth/resend
 *
 * This endpoint handles resending verification codes
 *
 * Flow:
 * 1. Validate input data (email)
 * 2. Find user by email
 * 3. Check if user exists and is not verified
 * 4. Generate new verification code
 * 5. Send new verification email
 * 6. Return success response
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/auth";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/emailVerification";

// Define the expected request body structure
interface ResendRequest {
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON from request body
    const body: ResendRequest = await request.json();
    const { email } = body;

    // Validate input data
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
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
        { error: "No pending registration found. Please register first." },
        { status: 404 }
      );
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Update pending registration with new verification code
    await prisma.pendingRegistration.update({
      where: { id: pendingRegistration.id },
      data: {
        verificationCode: verificationCode,
        verificationCodeExpires: verificationCodeExpires,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationCode);

    if (!emailResult.success) {
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
        message: "Verification code resent successfully!",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resend verification error:", error);

    // Return generic error message
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
