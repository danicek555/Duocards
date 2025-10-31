import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Fetch user's flashcard sets
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const flashcardSets = await prisma.flashcardSet.findMany({
      where: {
        userId: payload.userId,
      },
      include: {
        words: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ flashcardSets });
  } catch (error) {
    console.error("Error fetching flashcard sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch flashcard sets" },
      { status: 500 }
    );
  }
}

// POST - Create a new flashcard set with words
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const body = await request.json();
    const { name, words } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Flashcard set name is required" },
        { status: 400 }
      );
    }

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: "At least one word pair is required" },
        { status: 400 }
      );
    }

    // Validate word pairs
    for (const wordPair of words) {
      if (
        !wordPair.word ||
        !wordPair.word.trim() ||
        !wordPair.translation ||
        !wordPair.translation.trim()
      ) {
        return NextResponse.json(
          { error: "Each word must have both word and translation" },
          { status: 400 }
        );
      }
    }

    // Create flashcard set with words in a transaction
    const flashcardSet = await prisma.flashcardSet.create({
      data: {
        name: name.trim(),
        userId: payload.userId,
        words: {
          create: words.map(
            (wordPair: { word: string; translation: string }) => ({
              word: wordPair.word.trim(),
              translation: wordPair.translation.trim(),
              difficulty: 1,
              userId: payload.userId,
            })
          ),
        },
      },
      include: {
        words: true,
      },
    });

    return NextResponse.json({ flashcardSet }, { status: 201 });
  } catch (error) {
    console.error("Error creating flashcard set:", error);
    return NextResponse.json(
      { error: "Failed to create flashcard set" },
      { status: 500 }
    );
  }
}
