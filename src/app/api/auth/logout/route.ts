/**
 * API Route: POST /api/auth/logout
 *
 * This endpoint handles user logout by clearing the auth cookie
 */

import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    const res = NextResponse.json(
      {
        message: "Logout successful",
      },
      { status: 200 }
    );

    // Clear the auth cookie by setting it to expire immediately
    res.cookies.set("auth", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0, // Expire immediately
    });

    return res;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
