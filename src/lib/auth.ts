/**
 * Authentication utilities for password validation
 *
 * Uses Argon2id - the most secure password hashing algorithm available.
 * Argon2id is the winner of the Password Hashing Competition and is
 * recommended by OWASP for maximum security.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";

/**
 * Hash a password using Argon2id with secure parameters
 * @param password - Plain text password from user input
 * @returns Promise<string> - Secure Argon2id hash (includes salt)
 */
export async function hashPassword(password: string): Promise<string> {
  // Argon2id configuration for maximum security:
  // - type: argon2id - hybrid version resistant to both side-channel and GPU attacks
  // - memoryCost: 65536 (64 MB) - high memory usage makes GPU attacks expensive
  // - timeCost: 3 - number of iterations (balance between security and performance)
  // - parallelism: 4 - number of threads (adjust based on your server capacity)
  // - hashLength: 32 - 256-bit hash output
  //
  // These parameters provide excellent security while maintaining reasonable performance
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id, // Most secure variant - hybrid approach
      memoryCost: 65536, // 64 MB - makes GPU attacks computationally expensive
      timeCost: 3, // Number of iterations
      parallelism: 4, // Number of threads
      hashLength: 32, // 256-bit hash output
    });
    return hash;
  } catch (error) {
    // Log error but don't expose details to prevent information leakage
    console.error("Password hashing error:", error);
    throw new Error("Failed to hash password");
  }
}

/**
 * Compare a plain text password with an Argon2id hashed password
 * @param password - Plain text password from user input
 * @param hashedPassword - Argon2id hash from database
 * @returns Promise<boolean> - True if passwords match, false otherwise
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    // Validate that hashedPassword is a valid Argon2 hash format
    // Argon2 hashes always start with '$argon2' (argon2id, argon2i, or argon2d)
    if (!hashedPassword || typeof hashedPassword !== "string") {
      console.error(
        "Password verification error: Invalid hash format (null or not a string)"
      );
      return false;
    }

    if (!hashedPassword.startsWith("$argon2")) {
      console.error(
        "Password verification error: Invalid hash format (does not start with $argon2)",
        {
          hashPrefix: hashedPassword.substring(0, 20),
          hashLength: hashedPassword.length,
        }
      );
      return false;
    }

    // argon2.verify automatically handles:
    // - Salt extraction from the hash
    // - Timing attack protection
    // - Hash verification
    const isValid = await argon2.verify(hashedPassword, password);
    return isValid;
  } catch (error) {
    // Log error but return false for security (don't reveal if user exists)
    console.error("Password verification error:", error);
    return false;
  }
}

/**
 * Validate email format with enhanced security
 * @param email - Email address to validate
 * @returns boolean - True if email format is valid
 */
export function isValidEmail(email: string): boolean {
  // More strict email validation
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Basic format check
  if (!emailRegex.test(email)) {
    return false;
  }

  // Additional security checks
  const parts = email.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;

  // Local part validation
  if (localPart.length === 0 || localPart.length > 64) {
    return false;
  }

  // Domain validation
  if (domain.length === 0 || domain.length > 253) {
    return false;
  }

  // Check for valid domain structure
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return false;
  }

  // Each domain part should be valid
  for (const part of domainParts) {
    if (part.length === 0 || part.length > 63) {
      return false;
    }
    // Domain parts should only contain letters, numbers, and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(part)) {
      return false;
    }
    // Cannot start or end with hyphen
    if (part.startsWith("-") || part.endsWith("-")) {
      return false;
    }
  }

  // Top-level domain should be at least 2 characters
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns object with validation result and message
 */
export function validatePassword(password: string): {
  isValid: boolean;
  message: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (!/(?=.*[a-z])/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }

  if (!/(?=.*\d)/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one number",
    };
  }

  return { isValid: true, message: "Password is valid" };
}

// --- Minimal HMAC-signed auth token (JWT-like) ---
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // A publicly known fallback would let anyone forge auth tokens —
    // refuse to run without a real secret outside local development.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET (or NEXTAUTH_SECRET) must be set in production",
      );
    }
    return "dev-insecure-secret-change-me";
  }
  return secret;
}

export interface AuthPayload {
  userId: number;
  email: string;
  credentialVersion: string;
  exp: number; // epoch seconds
}

const CREDENTIAL_VERSION_CONTEXT = Buffer.from(
  "duocards-auth-credential-version:v1\0",
  "utf8",
);

function deriveCredentialVersion(passwordHash: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(CREDENTIAL_VERSION_CONTEXT)
    .update(Buffer.from(passwordHash, "utf8"))
    .digest("base64url");
}

function credentialVersionsMatch(
  providedVersion: string,
  expectedVersion: string,
): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(providedVersion)) return false;

  try {
    const provided = Buffer.from(providedVersion, "base64url");
    const expected = Buffer.from(expectedVersion, "base64url");

    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  } catch {
    return false;
  }
}

export async function createAuthToken(
  payload: Pick<AuthPayload, "userId" | "email">,
  verifiedPasswordHash: string,
  ttlSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body: AuthPayload = {
    ...payload,
    credentialVersion: deriveCredentialVersion(verifiedPasswordHash),
    exp,
  };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign", "verify"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const sig = Buffer.from(new Uint8Array(sigBuf)).toString("base64url");
  return `${data}.${sig}`;
}

export async function verifyAuthToken(
  token: string | undefined
): Promise<AuthPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;

  let payload: AuthPayload;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getAuthSecret()),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(sig, "base64url"),
      encoder.encode(data)
    );
    if (!valid) return null;

    const decoded = JSON.parse(
      Buffer.from(data, "base64url").toString()
    ) as Partial<AuthPayload>;
    if (
      typeof decoded.userId !== "number" ||
      !Number.isInteger(decoded.userId) ||
      decoded.userId <= 0 ||
      typeof decoded.email !== "string" ||
      decoded.email.length === 0 ||
      typeof decoded.credentialVersion !== "string" ||
      decoded.credentialVersion.length === 0 ||
      typeof decoded.exp !== "number" ||
      !Number.isFinite(decoded.exp) ||
      decoded.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    payload = {
      userId: decoded.userId,
      email: decoded.email,
      credentialVersion: decoded.credentialVersion,
      exp: decoded.exp,
    };
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true, password: true },
  });
  if (!user || user.email !== payload.email) return null;

  const expectedVersion = deriveCredentialVersion(user.password);
  if (!credentialVersionsMatch(payload.credentialVersion, expectedVersion)) {
    return null;
  }

  return payload;
}
