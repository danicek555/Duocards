/**
 * Prisma Client Configuration
 *
 * This file creates a singleton instance of PrismaClient
 * to prevent multiple connections in development (hot reloading)
 * and ensures proper connection management in production
 *
 * Supports both regular PostgreSQL and Prisma Accelerate connection strings
 *
 * For Prisma Accelerate: The PRISMA_DATABASE_URL should use prisma:// or prisma+postgres:// protocol
 * The directUrl (DIRECT_DATABASE_URL) is used for migrations and introspection
 */

import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Global variable to store Prisma client instance
// In development, this prevents creating multiple connections during hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Function to create Prisma client with proper configuration
function createPrismaClient(): PrismaClient {
  // Check if we're using Prisma Accelerate
  // Note: We check PRISMA_DATABASE_URL because that's what the schema uses
  const databaseUrl = process.env.PRISMA_DATABASE_URL || "";
  const isAccelerate =
    databaseUrl.startsWith("prisma://") ||
    databaseUrl.startsWith("prisma+postgres://");

  // Create base Prisma client
  // Prisma Client 6.x should support Accelerate URLs natively,
  // but we'll use the extension for better compatibility
  const baseClient = new PrismaClient({
    // Log database queries in development (helpful for debugging)
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  // For Accelerate URLs, apply the extension
  // The extended client is compatible with PrismaClient at runtime
  // We use type assertion to maintain compatibility
  if (isAccelerate) {
    const extended = baseClient.$extends(withAccelerate());
    // TypeScript doesn't recognize extended clients have all the same methods
    // But at runtime they do, so we assert the type
    return extended as unknown as PrismaClient;
  }

  return baseClient;
}

// Create Prisma client instance
// If it doesn't exist, create a new one
// If it exists (in development), reuse the existing one
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

// In development, store the client in global variable to prevent multiple instances
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Direct Prisma client for large data operations (bypasses Accelerate's 5MB limit)
// Use this for creating/updating WordImage and WordAudio records
const globalForDirectPrisma = globalThis as unknown as {
  prismaDirect: PrismaClient | undefined;
};

function createDirectPrismaClient(): PrismaClient {
  const directUrl = process.env.DIRECT_DATABASE_URL;

  // If DIRECT_DATABASE_URL is not set, fall back to regular prisma client
  // This happens when using Cloud SQL directly (not Prisma Accelerate)
  if (!directUrl) {
    // In production with Cloud SQL, both URLs are the same, so use regular client
    return prisma;
  }

  // For Prisma Accelerate, use direct URL for large data operations
  return new PrismaClient({
    datasources: {
      db: {
        url: directUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prismaDirect: PrismaClient =
  globalForDirectPrisma.prismaDirect ?? createDirectPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDirectPrisma.prismaDirect = prismaDirect;
}

/**
 * How this works:
 *
 * 1. In development:
 *    - Hot reloading can create multiple PrismaClient instances
 *    - This singleton pattern prevents that
 *    - The client is stored in globalThis and reused
 *
 * 2. In production:
 *    - Each serverless function gets its own instance
 *    - No need to store in global variable
 *
 * 3. Connection pooling:
 *    - Prisma automatically handles connection pooling
 *    - No need to manually manage connections
 *    - Connections are reused efficiently
 *
 * 4. Direct client for large data:
 *    - prismaDirect uses DIRECT_DATABASE_URL to bypass Accelerate
 *    - Use for operations with large payloads (>5MB) like images/audio
 *    - Regular prisma client uses Accelerate for better performance
 */
