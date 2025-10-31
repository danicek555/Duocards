import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

// GET - Fetch user's words
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify that the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    const words = await prisma.word.findMany({
      where: {
        userId: payload.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ words });
  } catch (error) {
    console.error("Error fetching words:", error);
    return NextResponse.json(
      { error: "Failed to fetch words" },
      { status: 500 }
    );
  }
}

// POST - Create a new word
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify that the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { word, translation, difficulty } = body;

    if (!word || !translation) {
      return NextResponse.json(
        { error: "Word and translation are required" },
        { status: 400 }
      );
    }

    const newWord = await prisma.word.create({
      data: {
        word,
        translation,
        difficulty: difficulty || 1,
        userId: payload.userId,
      },
    });

    return NextResponse.json({ word: newWord }, { status: 201 });
  } catch (error) {
    console.error("Error creating word:", error);
    return NextResponse.json(
      { error: "Failed to create word" },
      { status: 500 }
    );
  }
}

