import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranslateRequest {
  word: string;
  fromLanguage: string;
  toLanguage: string;
}

// POST - Translate a single word using AI
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "AI service is not configured.",
        },
        { status: 500 }
      );
    }

    let body: TranslateRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const { word, fromLanguage, toLanguage } = body;

    // Validate input
    if (!word || !word.trim()) {
      return NextResponse.json({ error: "Word is required" }, { status: 400 });
    }

    if (!fromLanguage || !toLanguage) {
      return NextResponse.json(
        { error: "Both source and target languages are required" },
        { status: 400 }
      );
    }

    // Use a lightweight model for single word translation
    const modelName = "gpt-4o-mini";

    const prompt = `Translate the word "${word.trim()}" from ${fromLanguage} to ${toLanguage}. 
Return only the translation, nothing else. If the word is a phrase or multiple words, translate it as a whole.
Do not include any explanations, context, or additional text - just the translation.`;

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content:
            "You are a language translation assistant. Return only the translation, no additional text or explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
      max_tokens: 50, // Single word/phrase translation shouldn't need many tokens
    });

    const translation = completion.choices[0]?.message?.content?.trim();

    if (!translation) {
      throw new Error("No translation received from AI");
    }

    // Clean up the translation (remove quotes if present, remove any extra text)
    let cleanTranslation = translation.replace(/^["']|["']$/g, "").trim();

    // If the response contains multiple lines or extra text, take the first meaningful part
    const lines = cleanTranslation.split("\n");
    if (lines.length > 1) {
      cleanTranslation = lines[0].trim();
    }

    return NextResponse.json(
      { translation: cleanTranslation },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error translating word:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to translate word",
      },
      { status: 500 }
    );
  }
}
