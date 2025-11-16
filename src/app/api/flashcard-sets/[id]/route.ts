import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

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

    // Fetch flashcard set with words and images/audio
    // Note: If this exceeds 5MB, consider implementing lazy loading for images/audio
    const flashcardSet = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: payload.userId,
      },
      include: {
        words: {
          include: {
            image: true,
            audio: true,
          } as Prisma.WordInclude,
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
    // If we hit the size limit, return a more helpful error
    if (
      error instanceof Error &&
      error.message.includes("exceeded the the maximum of 5MB")
    ) {
      return NextResponse.json(
        {
          error:
            "Flashcard set is too large. Please consider splitting it into smaller sets or removing some images/audio.",
        },
        { status: 413 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch flashcard set" },
      { status: 500 }
    );
  }
}
