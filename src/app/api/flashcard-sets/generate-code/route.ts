import { NextRequest, NextResponse } from "next/server";
import { generatePublicCode } from "@/lib/public-code";

// GET - Generate a preview public code (for display before saving)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    // Generate a unique public code
    const code = await generatePublicCode();

    return NextResponse.json({ code }, { status: 200 });
  } catch (error) {
    console.error("Error generating preview code:", error);
    return NextResponse.json(
      { error: "Failed to generate preview code" },
      { status: 500 }
    );
  }
}
