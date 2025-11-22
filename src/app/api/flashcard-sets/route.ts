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

    // Don't include image/audio data in list view to avoid response size limits
    // Image/audio data will be fetched separately when viewing individual flashcard sets
    const flashcardSets = await prisma.flashcardSet.findMany({
      where: {
        userId: payload.userId,
      },
      include: {
        words: {
          // Don't include image/audio relations to avoid large payloads
          // imageId and audioId are still available on the word object
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Ensure all AI-generated sets have "AI Generated" tag
    const updatedSets = await Promise.all(
      flashcardSets.map(async (set) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setWithTags = set as any;
        if (set.isAIGenerated && !setWithTags.tags?.includes("AI Generated")) {
          // Update the set to include "AI Generated" tag
          const updatedTags = [...(setWithTags.tags || []), "AI Generated"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma.flashcardSet.update as any)({
            where: { id: set.id },
            data: { tags: updatedTags },
          });
          return { ...set, tags: updatedTags };
        }
        return set;
      })
    );

    return NextResponse.json({ flashcardSets: updatedSets });
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
    const { name, words, fromLanguage, toLanguage, tags } = body;

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

    // Validate tags
    const tagsArray = Array.isArray(tags)
      ? tags.filter((tag: string) => tag.trim())
      : [];
    if (tagsArray.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 tags allowed per flashcard set" },
        { status: 400 }
      );
    }

    // Check total tags limit (20 tags across all sets)
    const allExistingSets = await prisma.flashcardSet.findMany({
      where: { userId: payload.userId },
    });
    const totalTagsCount = allExistingSets.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum, set) => sum + ((set as any).tags?.length || 0),
      0
    );
    if (totalTagsCount + tagsArray.length > 20) {
      return NextResponse.json(
        {
          error: `Maximum 20 tags allowed total. You currently have ${totalTagsCount} tags across all sets.`,
        },
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

    // Process words with images and audio
    const wordsWithExtras = await Promise.all(
      words.map(
        async (wordPair: {
          word: string;
          translation: string;
          pronunciation?: string;
          imageUrl?: string;
          audioUrl?: string;
        }) => {
          let imageId: number | undefined;
          let audioId: number | undefined;

          // Create image record if exists
          if (wordPair.imageUrl) {
            const mimeType = wordPair.imageUrl.startsWith("data:")
              ? wordPair.imageUrl.split(";")[0].split(":")[1] || "image/png"
              : "image/png";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const image = await (prisma as any).wordImage.create({
              data: {
                dataUrl: wordPair.imageUrl,
                mimeType: mimeType,
              },
            });
            imageId = image.id;
          }

          // Create audio record if exists
          if (wordPair.audioUrl) {
            const mimeType = wordPair.audioUrl.startsWith("data:")
              ? wordPair.audioUrl.split(";")[0].split(":")[1] || "audio/mpeg"
              : "audio/mpeg";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const audio = await (prisma as any).wordAudio.create({
              data: {
                dataUrl: wordPair.audioUrl,
                mimeType: mimeType,
              },
            });
            audioId = audio.id;
          }

          return {
            word: wordPair.word.trim(),
            translation: wordPair.translation.trim(),
            pronunciation: wordPair.pronunciation?.trim() || null,
            difficulty: 1,
            userId: payload.userId,
            imageId,
            audioId,
          };
        }
      )
    );

    // Create flashcard set with words in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flashcardSet = await (prisma.flashcardSet.create as any)({
      data: {
        name: name.trim(),
        userId: payload.userId,
        fromLanguage: fromLanguage || null,
        toLanguage: toLanguage || null,
        tags: tagsArray,
        words: {
          create: wordsWithExtras,
        },
      },
      include: {
        words: {
          include: {
            image: true,
            audio: true,
          },
        },
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
