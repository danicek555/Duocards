import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// POST - Join a public flashcard set by code
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the user exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || !code.trim()) {
      return NextResponse.json(
        { error: "Public code is required" },
        { status: 400 }
      );
    }

    // Normalize code format (remove spaces, convert to uppercase)
    const normalizedCode = code.trim().replace(/\s+/g, "").toUpperCase();

    // Find the public flashcard set by code
    // Since publicCode is unique, we can use findUnique
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publicSet = await (prisma.flashcardSet.findUnique as any)({
      where: { publicCode: normalizedCode },
      include: {
        words: {
          include: {
            image: true,
            audio: true,
          },
        },
      },
    });

    // Verify the set is public
    if (!publicSet || !publicSet.isPublic) {
      return NextResponse.json(
        { error: "Invalid public code or flashcard set not found" },
        { status: 404 }
      );
    }

    if (!publicSet) {
      return NextResponse.json(
        { error: "Invalid public code or flashcard set not found" },
        { status: 404 }
      );
    }

    // Check if user already has this set (by checking if they own it or have a set with same name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingSet = await (prisma.flashcardSet.findFirst as any)({
      where: {
        userId: payload.userId,
        publicCode: normalizedCode,
      },
    });

    if (existingSet) {
      return NextResponse.json(
        { error: "You already have this flashcard set" },
        { status: 400 }
      );
    }

    // Check maximum flashcard sets limit (100)
    const existingSetsCount = await prisma.flashcardSet.count({
      where: { userId: payload.userId },
    });

    if (existingSetsCount >= 100) {
      return NextResponse.json(
        { error: "Maximum 100 flashcard sets allowed" },
        { status: 400 }
      );
    }

    // Create a copy of the flashcard set for the user
    const newSet = await prisma.$transaction(async (tx) => {
      // Create the new flashcard set
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdSet = await (tx.flashcardSet.create as any)({
        data: {
          name: `${publicSet.name} (Shared)`,
          userId: payload.userId,
          fromLanguage: publicSet.fromLanguage,
          toLanguage: publicSet.toLanguage,
          isAIGenerated: publicSet.isAIGenerated,
          tags: publicSet.tags,
          isPublic: false, // User's copy is not public by default
          publicCode: null,
        },
      });

      // Copy all words with their images and audio
      const wordsToCreate = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (publicSet.words as any[]).map(async (word: any) => {
          let imageId: number | undefined;
          let audioId: number | undefined;

          // Copy image if exists
          if (word.imageId && word.image) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newImage = await (tx as any).wordImage.create({
              data: {
                dataUrl: word.image.dataUrl,
                mimeType: word.image.mimeType,
              },
            });
            imageId = newImage.id;
          }

          // Copy audio if exists
          if (word.audioId && word.audio) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newAudio = await (tx as any).wordAudio.create({
              data: {
                dataUrl: word.audio.dataUrl,
                mimeType: word.audio.mimeType,
              },
            });
            audioId = newAudio.id;
          }

          return {
            word: word.word,
            translation: word.translation,
            pronunciation: word.pronunciation,
            difficulty: word.difficulty,
            userId: payload.userId,
            flashcardSetId: createdSet.id,
            imageId,
            audioId,
          };
        })
      );

      // Create all words
      await tx.word.createMany({
        data: wordsToCreate,
      });

      // Fetch the created set with words
      return await tx.flashcardSet.findUnique({
        where: { id: createdSet.id },
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
    });

    return NextResponse.json(
      {
        flashcardSet: newSet,
        message: "Successfully joined public flashcard set!",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error joining public flashcard set:", error);
    return NextResponse.json(
      { error: "Failed to join public flashcard set" },
      { status: 500 }
    );
  }
}
