import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Preview the words of a single PUBLIC flashcard set (catalog detail)
//
// Returns word/translation/pronunciation plus hasImage/hasAudio flags only —
// no image or audio payloads, so the response stays small. Only sets with
// isPublic = true are accessible regardless of owner.
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
    const setId = parseInt(id, 10);
    if (Number.isNaN(setId)) {
      return NextResponse.json(
        { error: "Invalid flashcard set ID" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set = await (prisma.flashcardSet.findFirst as any)({
      where: { id: setId, isPublic: true },
      select: {
        id: true,
        name: true,
        fromLanguage: true,
        toLanguage: true,
        publicCode: true,
        user: { select: { nickname: true } },
        words: {
          select: {
            id: true,
            word: true,
            translation: true,
            pronunciation: true,
            imageId: true,
            audioId: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!set) {
      return NextResponse.json(
        { error: "Public flashcard set not found" },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const words = (set.words as any[]).map((w) => ({
      id: w.id,
      word: w.word,
      translation: w.translation,
      pronunciation: w.pronunciation,
      hasImage: w.imageId != null,
      hasAudio: w.audioId != null,
    }));

    return NextResponse.json({
      set: {
        id: set.id,
        name: set.name,
        fromLanguage: set.fromLanguage,
        toLanguage: set.toLanguage,
        publicCode: set.publicCode,
        ownerNickname: set.user?.nickname ?? "User",
      },
      words,
    });
  } catch (error) {
    console.error("Error fetching public flashcard set detail:", error);
    return NextResponse.json(
      { error: "Failed to load public flashcard set" },
      { status: 500 }
    );
  }
}
