import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  generatePasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/emailVerification";

interface ForgotPasswordRequest {
  email: string;
}

const GENERIC_SUCCESS_MESSAGE =
  "If an account with this email exists, we sent a password reset link.";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = await checkRateLimit(
      `forgot-password:ip:${clientIp}`,
      20,
      15 * 60 * 1000
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { message: GENERIC_SUCCESS_MESSAGE },
        {
          status: 200,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    const body: ForgotPasswordRequest = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const emailLimit = await checkRateLimit(
      `forgot-password:email:${email.toLowerCase()}`,
      5,
      15 * 60 * 1000
    );
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { message: GENERIC_SUCCESS_MESSAGE },
        {
          status: 200,
          headers: { "Retry-After": String(emailLimit.retryAfterSeconds) },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    // Always return generic success to prevent account enumeration.
    if (!user) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    const { raw, hashed } = generatePasswordResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashed,
        expiresAt,
      },
    });

    const emailResult = await sendPasswordResetEmail(user.email, raw);

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
    }

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { message: GENERIC_SUCCESS_MESSAGE },
      { status: 200 }
    );
  }
}
