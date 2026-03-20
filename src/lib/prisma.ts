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
 *
 * NOTE: This file is server-only and should never be imported in client components
 */

import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Import adapter loader (server-side only - Next.js will exclude from client bundle)
// The prisma-adapter.ts file uses top-level imports which webpack will handle correctly
import { createPgAdapter } from "./prisma-adapter";

// Global variable to store Prisma client instance
// In development, this prevents creating multiple connections during hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Function to create Prisma client with proper configuration
function createPrismaClient(): PrismaClient {
  // Prefer direct DB connection in development to avoid network/DNS dependency
  // on Prisma Accelerate while developing locally.
  const directUrl = process.env.DIRECT_DATABASE_URL || "";
  const isDevelopment = process.env.NODE_ENV !== "production";
  const shouldPreferDirect = isDevelopment && directUrl.length > 0;
  const databaseUrl = shouldPreferDirect
    ? directUrl
    : process.env.PRISMA_DATABASE_URL || "";
  const isAccelerate =
    !shouldPreferDirect &&
    (databaseUrl.startsWith("prisma://") ||
      databaseUrl.startsWith("prisma+postgres://"));

  // Prisma 7: Use accelerateUrl for Accelerate, adapter for direct connections
  if (isAccelerate) {
    const baseClient = new PrismaClient({
      accelerateUrl: databaseUrl,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
    // Apply Accelerate extension for additional features
    const extended = baseClient.$extends(withAccelerate());
    return extended as unknown as PrismaClient;
  }

  // Direct PostgreSQL connection
  // Prisma 7 REQUIRES an adapter for direct connections
  const adapter = createPgAdapter(databaseUrl);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
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
  // Prisma 7: Use adapter for direct connections
  const adapter = createPgAdapter(directUrl);

  return new PrismaClient({
    adapter,
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
