import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Fetch word audio by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const audioId = parseInt(id);
    if (isNaN(audioId)) {
      return NextResponse.json({ error: "Invalid audio ID" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audio = await (prisma as any).wordAudio.findUnique({
      where: { id: audioId },
      select: {
        id: true,
        dataUrl: true,
        mimeType: true,
      },
    });

    if (!audio) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    // Verify the audio belongs to a word owned by the user
    // Prisma types don't recognize audioId in where clause, but it works at runtime
    const word = await prisma.word.findFirst({
      where: {
        audioId: audioId,
        userId: payload.userId,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (!word) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ audio });
  } catch (error) {
    console.error("Error fetching word audio:", error);
    return NextResponse.json(
      { error: "Failed to fetch word audio" },
      { status: 500 }
    );
  }
}
