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
import { hashPassword, isValidEmail } from "@/lib/auth";
import { validatePassword } from "@/lib/passwordValidation";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/emailVerification";

// Define the expected request body structure
interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON from request body
    const body: RegisterRequest = await request.json();
    const { email, password, nickname } = body;

    // Validate input data
    if (!email || !password || !nickname) {
      return NextResponse.json(
        { error: "Email, password, and nickname are required" },
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

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.message },
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
        { error: "User with this email already exists" },
        { status: 409 } // 409 = Conflict
      );
    }

    // Hash the password before storing
    const hashedPassword = hashPassword(password);

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
  } catch (error) {
    console.error("Registration error:", error);

    // Return generic error message (don't expose internal errors)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Security Notes:
 *
 * 1. Password Hashing:
 *    - We hash passwords with bcrypt before storing
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
