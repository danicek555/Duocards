import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateRequest {
  level: string;
  topic: string;
  language: string;
  setName?: string;
  wordCount?: number;
}

// POST - Generate flashcards using AI
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

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "AI service is not configured. Please add OPENAI_API_KEY to your environment variables.",
        },
        { status: 500 }
      );
    }

    const body: GenerateRequest = await request.json();
    const { level, topic, language, setName, wordCount = 10 } = body;

    // Validate input
    if (!level || !topic || !language) {
      return NextResponse.json(
        { error: "Level, topic, and language are required" },
        { status: 400 }
      );
    }

    // Generate set name if not provided
    const generatedSetName = setName || `${topic} - ${level} (${language})`;

    // Create prompt for OpenAI
    const prompt = `Generate ${wordCount} flashcards for learning ${language} at ${level} level about the topic: "${topic}".

Return a JSON object with a "flashcards" array containing objects with this exact structure:
{
  "flashcards": [
    {"word": "English word or phrase", "translation": "Translation in ${language}"},
    {"word": "Another word", "translation": "Translation in ${language}"}
  ]
}

Requirements:
- Use appropriate vocabulary for ${level} level
- Focus on the topic: ${topic}
- Provide accurate translations in ${language}
- Make words/phrases practical and useful
- Return only valid JSON, no additional text or markdown formatting
- Include exactly ${wordCount} flashcards`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano", // Using cost-effective model
      messages: [
        {
          role: "system",
          content:
            "You are a helpful language learning assistant that creates flashcards. Always return valid JSON objects with a 'flashcards' array, no additional text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }, // Force JSON mode
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let words: { word: string; translation: string }[];
    try {
      // Try parsing as direct JSON first
      let parsed: unknown = JSON.parse(content);

      // Handle different response formats
      if (typeof parsed === "string") {
        // If it's still a string, try to extract JSON array
        const jsonMatch = parsed.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not parse JSON from response");
        }
      }

      // Handle case where response might be wrapped in an object with a "words" or "flashcards" key
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.words)) {
          parsed = obj.words;
        } else if (Array.isArray(obj.flashcards)) {
          parsed = obj.flashcards;
        } else if (Array.isArray(obj.cards)) {
          parsed = obj.cards;
        }
      }

      // Ensure it's an array
      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }

      words = parsed as { word: string; translation: string }[];

      // Validate each word pair
      words = words.filter(
        (item) =>
          item &&
          typeof item.word === "string" &&
          typeof item.translation === "string" &&
          item.word.trim() &&
          item.translation.trim()
      );

      if (words.length === 0) {
        throw new Error("No valid flashcards generated");
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      console.error("Response content:", content);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Create flashcard set with words
    const flashcardSet = await prisma.flashcardSet.create({
      data: {
        name: generatedSetName,
        userId: payload.userId,
        words: {
          create: words.map((wordPair) => ({
            word: wordPair.word.trim(),
            translation: wordPair.translation.trim(),
            difficulty: 1,
            userId: payload.userId,
          })),
        },
      },
      include: {
        words: true,
      },
    });

    return NextResponse.json(
      {
        flashcardSet,
        message: `Successfully generated ${words.length} flashcards!`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error generating flashcards:", error);

    // Handle OpenAI-specific errors
    if (error && typeof error === "object" && "status" in error) {
      const openaiError = error as {
        status?: number;
        code?: string;
        message?: string;
      };

      // Quota exceeded (429 with insufficient_quota)
      if (
        openaiError.status === 429 ||
        openaiError.code === "insufficient_quota"
      ) {
        return NextResponse.json(
          {
            error:
              "OpenAI quota exceeded. Please check your OpenAI account billing and add payment method if needed. Visit https://platform.openai.com/account/billing",
          },
          { status: 429 }
        );
      }

      // Rate limit (429 but different code)
      if (openaiError.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a few moments." },
          { status: 429 }
        );
      }

      // Invalid API key
      if (
        openaiError.status === 401 ||
        openaiError.code === "invalid_api_key"
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.",
          },
          { status: 401 }
        );
      }
    }

    // Handle general Error instances
    if (error instanceof Error) {
      if (
        error.message.includes("API key") ||
        error.message.includes("authentication")
      ) {
        return NextResponse.json(
          { error: "Invalid OpenAI API key. Please check your configuration." },
          { status: 500 }
        );
      }
      if (
        error.message.includes("quota") ||
        error.message.includes("billing")
      ) {
        return NextResponse.json(
          {
            error:
              "OpenAI quota exceeded. Please add billing information to your account at https://platform.openai.com/account/billing",
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate flashcards. Please try again." },
      { status: 500 }
    );
  }
}
