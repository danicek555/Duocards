/**
 * Environment validation utility
 * Helps identify missing or incorrect environment variables
 */

export interface EnvironmentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvironmentValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required environment variables
  // Note: We use PRISMA_DATABASE_URL (not DATABASE_URL) to match Prisma schema
  const requiredVars = {
    PRISMA_DATABASE_URL:
      process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL,
  };

  // Check required variables
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });

  // Check optional but recommended variables
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push("NEXT_PUBLIC_APP_URL not set, using localhost fallback");
  }

  if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
    warnings.push("NEXT_PUBLIC_API_BASE_URL not set, using /api fallback");
  }

  // Validate email format
  if (process.env.FROM_EMAIL && !isValidEmail(process.env.FROM_EMAIL)) {
    errors.push("FROM_EMAIL has invalid email format");
  }

  // Validate database URL format
  const dbUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
  if (
    dbUrl &&
    !dbUrl.startsWith("postgres") &&
    !dbUrl.startsWith("prisma://") &&
    !dbUrl.startsWith("prisma+postgres://")
  ) {
    warnings.push(
      "PRISMA_DATABASE_URL does not appear to be a valid PostgreSQL or Prisma Accelerate connection string"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function logEnvironmentStatus() {
  const validation = validateEnvironment();

  console.log("Environment Validation:", {
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });

  return validation;
}
