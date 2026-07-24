import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeWordAudio, storeWordImage } from "@/lib/imageStorage";
import { verifyAuthToken } from "@/lib/auth";
import { generatePublicCode } from "@/lib/public-code";

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

    // Fetch flashcard set with words, but exclude image/audio data to avoid 5MB limit
    // Images/audio will be fetched separately via /api/words/[id]/image and /api/words/[id]/audio
    const flashcardSet = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: payload.userId,
      },
      include: {
        words: {
          // Don't include image/audio relations - fetch them separately when needed
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

// DELETE - Delete a flashcard set
export async function DELETE(
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

    // Verify that the flashcard set belongs to the user
    const flashcardSet = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: payload.userId,
      },
    });

    if (!flashcardSet) {
      return NextResponse.json(
        { error: "Flashcard set not found" },
        { status: 404 }
      );
    }

    // Delete the flashcard set (cascade will delete words and related data)
    await prisma.flashcardSet.delete({
      where: {
        id: setId,
      },
    });

    return NextResponse.json(
      { message: "Flashcard set deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting flashcard set:", error);
    return NextResponse.json(
      { error: "Failed to delete flashcard set" },
      { status: 500 }
    );
  }
}

// PATCH - Update a flashcard set
export async function PATCH(
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

    // Verify that the flashcard set belongs to the user
    const flashcardSet = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: payload.userId,
      },
    });

    if (!flashcardSet) {
      return NextResponse.json(
        { error: "Flashcard set not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      words,
      fromLanguage,
      toLanguage,
      tags,
      isPublic,
      previewCode,
    } = body;

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

    // Validate tags
    let tagsArray = Array.isArray(tags)
      ? tags.filter((tag: string) => tag.trim())
      : [];

    // Add "public" tag if set is public, remove it if not
    if (isPublic === true) {
      if (!tagsArray.includes("public")) {
        tagsArray.push("public");
      }
    } else {
      tagsArray = tagsArray.filter((tag: string) => tag !== "public");
    }

    if (tagsArray.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 tags allowed per flashcard set" },
        { status: 400 }
      );
    }

    // Check unique tags limit (20 different tags across all sets, excluding current set)
    const allExistingSets = await prisma.flashcardSet.findMany({
      where: { userId: payload.userId },
    });
    // Collect all unique tags from existing sets (excluding current set)
    const existingUniqueTags = new Set<string>();
    allExistingSets
      .filter((set) => set.id !== setId)
      .forEach((set) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setTags = (set as any).tags || [];
        setTags.forEach((tag: string) => {
          if (tag.trim()) {
            existingUniqueTags.add(tag.trim());
          }
        });
      });

    // Count how many new unique tags are being added
    const newUniqueTags = tagsArray.filter(
      (tag: string) => !existingUniqueTags.has(tag.trim())
    );
    const uniqueTagsCount = existingUniqueTags.size + newUniqueTags.length;

    if (uniqueTagsCount > 20) {
      return NextResponse.json(
        {
          error: `Maximum 20 different tags allowed across all sets. You currently have ${existingUniqueTags.size} unique tags across other sets.`,
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
            // Zkomprimovat (WebP 512px) a nahrát do Vercel Blob; v DB zůstává jen URL.
            const storedImage = await storeWordImage(wordPair.imageUrl);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const image = await (prisma as any).wordImage.create({
              data: {
                dataUrl: storedImage.dataUrl,
                mimeType: storedImage.mimeType,
              },
            });
            imageId = image.id;
          }

          // Create audio record if exists
          if (wordPair.audioUrl) {
            // Audio se přesouvá do Vercel Blob beze změny formátu.
            const storedAudio = await storeWordAudio(wordPair.audioUrl);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const audio = await (prisma as any).wordAudio.create({
              data: {
                dataUrl: storedAudio.dataUrl,
                mimeType: storedAudio.mimeType,
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

    // Handle public code generation/removal
    let publicCode: string | null = null;
    if (isPublic === true) {
      // Use preview code if provided (user wants to keep/change it)
      if (previewCode && typeof previewCode === "string") {
        // Verify it's unique (in case of race condition or if user changed it)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = await (prisma.flashcardSet.findUnique as any)({
          where: { publicCode: previewCode },
          select: { id: true },
        });
        // If code exists and belongs to a different set, generate new one
        if (existing && existing.id !== setId) {
          publicCode = await generatePublicCode();
        } else {
          publicCode = previewCode;
        }
      } else if (flashcardSet.publicCode) {
        // Keep existing code if no preview code provided
        publicCode = flashcardSet.publicCode;
      } else {
        // Generate new code if set is being made public for the first time
        publicCode = await generatePublicCode();
      }
    } else {
      // If making set private, remove the code
      publicCode = null;
    }

    // Delete all existing words and create new ones
    // This is simpler than trying to match and update individual words
    await prisma.$transaction(async (tx) => {
      // Delete existing words
      await tx.word.deleteMany({
        where: {
          flashcardSetId: setId,
        },
      });

      // Update flashcard set name and languages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx.flashcardSet.update as any)({
        where: {
          id: setId,
        },
        data: {
          name: name.trim(),
          fromLanguage: fromLanguage || null,
          toLanguage: toLanguage || null,
          tags: tagsArray,
          isPublic: isPublic === true,
          publicCode: publicCode,
          words: {
            create: wordsWithExtras,
          },
        },
      });
    });

    // Fetch updated flashcard set
    const updatedSet = await prisma.flashcardSet.findUnique({
      where: {
        id: setId,
      },
      include: {
        words: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json({ flashcardSet: updatedSet }, { status: 200 });
  } catch (error) {
    console.error("Error updating flashcard set:", error);
    return NextResponse.json(
      { error: "Failed to update flashcard set" },
      { status: 500 }
    );
  }
}
