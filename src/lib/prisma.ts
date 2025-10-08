/**
 * Prisma Client Configuration
 *
 * This file creates a singleton instance of PrismaClient
 * to prevent multiple connections in development (hot reloading)
 * and ensures proper connection management in production
 */

import { PrismaClient } from "@prisma/client";

// Global variable to store Prisma client instance
// In development, this prevents creating multiple connections during hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client instance
// If it doesn't exist, create a new one
// If it exists (in development), reuse the existing one
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Log database queries in development (helpful for debugging)
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// In development, store the client in global variable to prevent multiple instances
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
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
 */
