/**
 * Prisma Client Configuration with Accelerate
 *
 * This file creates a singleton instance of PrismaClient with Accelerate extension
 * for improved performance and connection pooling in production
 */

import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

// Global variable to store Prisma client instance
// In development, this prevents creating multiple connections during hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

// Create Prisma client with Accelerate extension
function createPrismaClient() {
  return new PrismaClient({
    // Log database queries in development (helpful for debugging)
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends(withAccelerate());
}

// Create Prisma client instance with Accelerate extension
// If it doesn't exist, create a new one
// If it exists (in development), reuse the existing one
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

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
 * 3. Prisma Accelerate Benefits:
 *    - Connection pooling for better performance
 *    - Query caching to reduce database load
 *    - Global edge locations for faster queries
 *    - Automatic connection management
 *    - Built-in retry logic for failed queries
 *
 * 4. Edge Client:
 *    - Optimized for serverless environments
 *    - Smaller bundle size
 *    - Better performance on Vercel
 */
