import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Fetch word image by ID
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
    const imageId = parseInt(id);
    if (isNaN(imageId)) {
      return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const image = await (prisma as any).wordImage.findUnique({
      where: { id: imageId },
      select: {
        id: true,
        dataUrl: true,
        mimeType: true,
      },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Verify the image belongs to a word owned by the user
    // Prisma types don't recognize imageId in where clause, but it works at runtime
    const word = await prisma.word.findFirst({
      where: {
        imageId: imageId,
        userId: payload.userId,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (!word) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ image });
  } catch (error) {
    console.error("Error fetching word image:", error);
    return NextResponse.json(
      { error: "Failed to fetch word image" },
      { status: 500 }
    );
  }
}
