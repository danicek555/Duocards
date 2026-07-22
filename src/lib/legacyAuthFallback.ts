import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthToken, hashPassword, isValidEmail } from "@/lib/auth";
import { validatePassword } from "@/lib/passwordValidation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseRequestLocale } from "@/lib/locale";
import { COIN_TRANSACTION_TYPES } from "@/lib/coinEconomy";
import {
  generatePasswordResetToken,
  generateVerificationCode,
  hashPasswordResetToken,
  isValidVerificationCode,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/emailVerification";

const WELCOME_COINS = 100;
const welcomeCoinTransaction = {
  create: {
    amount: WELCOME_COINS,
    balanceAfter: WELCOME_COINS,
    type: COIN_TRANSACTION_TYPES.welcomeBonus,
  },
} as const;

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json({ error, ...(code ? { code } : {}) }, { status });
}

async function limited(request: NextRequest, key: string, limit: number) {
  return checkRateLimit(`${key}:ip:${getClientIp(request)}`, limit, 15 * 60 * 1000);
}

export async function fallbackRegister(request: NextRequest) {
  try {
    const ipLimit = await limited(request, "register", 20);
    if (!ipLimit.allowed) return jsonError("Too many registration attempts. Please try again later.", 429, "RATE_LIMIT_REGISTER");

    const body = (await request.json()) as { email?: string; password?: string; nickname?: string; locale?: string };
    const email = body.email?.trim().toLowerCase();
    const nickname = body.nickname?.trim();
    if (!email || !body.password || !nickname) return jsonError("Email, password, and nickname are required", 400, "REQUIRED_FIELDS");
    if (!isValidEmail(email)) return jsonError("Invalid email format", 400, "INVALID_EMAIL");
    const passwordResult = validatePassword(body.password);
    if (!passwordResult.isValid) return jsonError(passwordResult.message, 400, "PASSWORD_WEAK");
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return jsonError("User with this email already exists", 409, "EMAIL_EXISTS");

    const password = await hashPassword(body.password);
    const locale = parseRequestLocale(body.locale);
    if (process.env.SKIP_EMAIL_VERIFICATION === "true") {
      const user = await prisma.user.create({
        data: {
          email,
          password,
          nickname,
          locale,
          emailVerified: true,
          coinTransactions: welcomeCoinTransaction,
        },
        select: { id: true, email: true, nickname: true, locale: true, emailVerified: true, createdAt: true },
      });
      const token = await createAuthToken({ userId: user.id, email: user.email }, password);
      const response = NextResponse.json({ message: "Registration successful!", user, requiresVerification: false }, { status: 201 });
      response.cookies.set("auth", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
      return response;
    }

    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.pendingRegistration.upsert({
      where: { email },
      update: { password, nickname, locale, verificationCode, verificationCodeExpires },
      create: { email, password, nickname, locale, verificationCode, verificationCodeExpires },
    });
    const sent = await sendVerificationEmail(email, verificationCode);
    if (!sent.success) {
      await prisma.pendingRegistration.deleteMany({ where: { email } });
      return jsonError(sent.error || "Failed to send verification email.", 400);
    }
    return NextResponse.json({ message: "Registration successful! Please check your email for verification code.", email, requiresVerification: true }, { status: 201 });
  } catch (error) {
    console.error("Fallback registration error:", error);
    return jsonError("An unexpected error occurred. Please try again.", 500, "UNKNOWN_ERROR");
  }
}

export async function fallbackVerify(request: NextRequest) {
  try {
    const ipLimit = await limited(request, "verify", 30);
    if (!ipLimit.allowed) return jsonError("Too many requests. Please try again later.", 429);
    const body = (await request.json()) as { email?: string; code?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.code) return jsonError("Email and verification code are required", 400);
    if (!isValidEmail(email) || !isValidVerificationCode(body.code)) return jsonError("Invalid verification data", 400);
    const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
    if (!pending) return jsonError("No pending registration found for this email. Please register first.", 404);
    if (pending.verificationCode !== body.code) return jsonError("Invalid verification code", 400);
    if (pending.verificationCodeExpires < new Date()) {
      await prisma.pendingRegistration.delete({ where: { email } });
      return jsonError("Verification code has expired. Please register again.", 400);
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          password: pending.password,
          nickname: pending.nickname,
          locale: pending.locale,
          emailVerified: true,
          coinTransactions: welcomeCoinTransaction,
        },
        select: { id: true, email: true, nickname: true, locale: true, emailVerified: true, createdAt: true },
      });
      await tx.pendingRegistration.delete({ where: { email } });
      return created;
    });
    const token = await createAuthToken({ userId: user.id, email: user.email }, pending.password);
    const response = NextResponse.json({ message: "Email verified successfully!", user });
    response.cookies.set("auth", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
    return response;
  } catch (error) {
    console.error("Fallback verification error:", error);
    return jsonError("Internal server error", 500);
  }
}

export async function fallbackResend(request: NextRequest) {
  try {
    const ipLimit = await limited(request, "resend", 20);
    if (!ipLimit.allowed) return jsonError("Too many requests. Please try again later.", 429);
    const { email: rawEmail } = (await request.json()) as { email?: string };
    const email = rawEmail?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) return jsonError("A valid email is required", 400);
    const emailLimit = await checkRateLimit(`resend:email:${email}`, 5, 10 * 60 * 1000);
    if (!emailLimit.allowed) return jsonError("Too many requests. Please try again later.", 429);
    const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
    if (!pending) return jsonError("No pending registration found. Please register first.", 404);
    const verificationCode = generateVerificationCode();
    await prisma.pendingRegistration.update({ where: { email }, data: { verificationCode, verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) } });
    const sent = await sendVerificationEmail(email, verificationCode);
    if (!sent.success) return jsonError(sent.error || "Failed to send verification email.", 400);
    return NextResponse.json({ message: "Verification code resent successfully!" });
  } catch (error) {
    console.error("Fallback resend error:", error);
    return jsonError("Internal server error", 500);
  }
}

const resetMessage = "If an account with this email exists, we sent a password reset link. Please check your spam or junk folder too.";

export async function fallbackForgotPassword(request: NextRequest) {
  try {
    const ipLimit = await limited(request, "forgot-password", 20);
    if (!ipLimit.allowed) return NextResponse.json({ message: resetMessage });
    const { email: rawEmail } = (await request.json()) as { email?: string };
    const email = rawEmail?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) return jsonError("A valid email is required", 400);
    const emailLimit = await checkRateLimit(`forgot-password:email:${email}`, 5, 15 * 60 * 1000);
    if (!emailLimit.allowed) return NextResponse.json({ message: resetMessage });
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) return NextResponse.json({ message: resetMessage });
    const token = generatePasswordResetToken();
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: token.hashed, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } }),
    ]);
    const sent = await sendPasswordResetEmail(user.email, token.raw);
    if (!sent.success) console.error("Fallback reset email failed:", sent.error);
    return NextResponse.json({ message: resetMessage });
  } catch (error) {
    console.error("Fallback forgot-password error:", error);
    return NextResponse.json({ message: resetMessage });
  }
}

export async function fallbackResetPassword(request: NextRequest) {
  try {
    const ipLimit = await limited(request, "reset-password", 20);
    if (!ipLimit.allowed) return jsonError("Too many requests. Please try again later.", 429);
    const body = (await request.json()) as { token?: string; password?: string };
    if (!body.token || !body.password || body.token.length < 32 || body.token.length > 256) return jsonError("Invalid or expired reset token", 400);
    const passwordResult = validatePassword(body.password);
    if (!passwordResult.isValid) return jsonError(passwordResult.message, 400);
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashPasswordResetToken(body.token) } });
    if (!reset || reset.expiresAt < new Date()) return jsonError("Invalid or expired reset token", 400);
    const password = await hashPassword(body.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { password } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } }),
    ]);
    return NextResponse.json({ message: "Password reset successful. You can now sign in." });
  } catch (error) {
    console.error("Fallback reset-password error:", error);
    return jsonError("Failed to reset password. Please try again.", 500);
  }
}
