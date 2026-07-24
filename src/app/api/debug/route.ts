/**
 * Debug API Route: GET /api/debug
 *
 * This endpoint helps debug deployment issues on Vercel
 * Only available in development and staging environments
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/adminAuth";

interface DebugInfo {
  environment: {
    nodeEnv: string | undefined;
    vercelEnv: string | undefined;
    hasDatabaseUrl: boolean;
    hasResendKey: boolean;
    hasFromEmail: boolean;
    appUrl: string | undefined;
    apiBaseUrl: string | undefined;
  };
  database: {
    connectionStatus: string;
    userCount?: number;
    pendingCount?: number;
    wordCount?: number;
    error?: string;
    code?: string;
  };
  timestamp: string;
}

export async function GET() {
  // Open for local debugging in development. Anywhere else this endpoint leaks
  // which secrets are configured and table row counts, so it requires an
  // authenticated admin — regardless of ENABLE_DEBUG, which must never open it
  // to anonymous callers in production.
  if (process.env.NODE_ENV !== "development") {
    const guard = await requireAdminApi("debug.info");
    if ("response" in guard) {
      return NextResponse.json(
        { error: "Debug endpoint not available" },
        { status: 404 }
      );
    }
  }

  try {
    const debugInfo: DebugInfo = {
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasFromEmail: !!process.env.FROM_EMAIL,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      },
      database: {
        connectionStatus: "testing...",
      },
      timestamp: new Date().toISOString(),
    };

    // Test database connection
    try {
      const userCount = await prisma.user.count();
      const pendingCount = await prisma.pendingRegistration.count();
      const wordCount = await prisma.word.count();

      debugInfo.database = {
        connectionStatus: "connected",
        userCount,
        pendingCount,
        wordCount,
      };
    } catch (dbError: unknown) {
      const isPrismaError = (
        err: unknown
      ): err is { code: string; message: string } => {
        return (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          "message" in err
        );
      };

      debugInfo.database = {
        connectionStatus: "failed",
        error: isPrismaError(dbError)
          ? dbError.message
          : "Unknown database error",
        code: isPrismaError(dbError) ? dbError.code : "UNKNOWN",
      };
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error: unknown) {
    const isStandardError = (err: unknown): err is Error => {
      return err instanceof Error;
    };

    return NextResponse.json(
      {
        error: "Debug endpoint failed",
        message: isStandardError(error) ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
