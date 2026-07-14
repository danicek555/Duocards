import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Browse and search the public catalog of flashcard sets
//
// Query params:
//   q        - case-insensitive substring match on the set name (optional)
//   tags     - comma-separated list of tags; a set matches if it has ANY of them (optional)
//   page     - 1-based page number (default 1)
//   pageSize - results per page (default 20, max 50)
//
// Only sets with isPublic = true are returned. Word/image/audio payloads are
// intentionally omitted to keep the response small; the catalog shows metadata
// plus a word count. Adding a set to the account is done via the existing
// /api/flashcard-sets/join endpoint using the returned publicCode.
//
// Each item carries two ownership flags for the caller:
//   ownedByMe    - the caller is the author of the set
//   alreadyAdded - the caller previously joined this set (matched via the
//                  joinedFromCode stored on their copy)
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

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const tagsParam = (searchParams.get("tags") || "").trim();
    const tags = tagsParam
      ? tagsParam
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20)
    );

    // Build the where clause. Always restrict to public sets.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { isPublic: true };

    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }

    if (tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Codes of public sets the caller has already joined (their copies keep
    // the original code in joinedFromCode).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mySets = await (prisma.flashcardSet.findMany as any)({
      where: { userId: payload.userId },
      select: { joinedFromCode: true },
    });
    const joinedCodes = new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mySets as any[])
        .map((s) => s.joinedFromCode)
        .filter((c): c is string => typeof c === "string" && c.length > 0)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [total, sets] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.flashcardSet.count as any)({ where }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.flashcardSet.findMany as any)({
        where,
        select: {
          id: true,
          name: true,
          userId: true,
          fromLanguage: true,
          toLanguage: true,
          tags: true,
          publicCode: true,
          isAIGenerated: true,
          createdAt: true,
          user: { select: { nickname: true } },
          _count: { select: { words: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Flatten the response into a stable shape for the catalog UI.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (sets as any[]).map((set) => ({
      id: set.id,
      name: set.name,
      fromLanguage: set.fromLanguage,
      toLanguage: set.toLanguage,
      tags: set.tags || [],
      publicCode: set.publicCode,
      isAIGenerated: set.isAIGenerated,
      createdAt: set.createdAt,
      ownerNickname: set.user?.nickname ?? "User",
      wordCount: set._count?.words ?? 0,
      ownedByMe: set.userId === payload.userId,
      alreadyAdded: set.publicCode ? joinedCodes.has(set.publicCode) : false,
    }));

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("Error browsing public flashcard sets:", error);
    return NextResponse.json(
      { error: "Failed to load public flashcard sets" },
      { status: 500 }
    );
  }
}
