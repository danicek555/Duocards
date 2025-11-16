import { NextRequest, NextResponse } from "next/server";
import { prismaDirect } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Fetch a specific flashcard set with its words
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
    const setId = parseInt(id);
    if (isNaN(setId)) {
      return NextResponse.json(
        { error: "Invalid flashcard set ID" },
        { status: 400 }
      );
    }

    // Use direct client to avoid Accelerate's 5MB response limit when including image/audio data
    const flashcardSet = await prismaDirect.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: payload.userId,
      },
      include: {
        words: {
          include: {
            image: true,
            audio: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!flashcardSet) {
      return NextResponse.json(
        { error: "Flashcard set not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ flashcardSet });
  } catch (error) {
    console.error("Error fetching flashcard set:", error);
    return NextResponse.json(
      { error: "Failed to fetch flashcard set" },
      { status: 500 }
    );
  }
}
