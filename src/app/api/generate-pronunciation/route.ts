import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import {
  addCoins,
  COIN_TRANSACTION_TYPES,
  deductCoins,
  InsufficientCoinsError,
} from "@/lib/coins";
import { COIN_COSTS } from "@/lib/coin-costs";
import { enforceAiRateLimit } from "@/lib/aiGuard";

// Initialize OpenAI client lazily to avoid build-time errors
async function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  // Lazy import OpenAI only when needed
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

interface PronunciationRequest {
  word: string;
  language: string;
}

// POST - Generate pronunciation for a word using AI
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

    let body: PronunciationRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const { word, language } = body;

    // Validate input
    if (!word || !word.trim()) {
      return NextResponse.json({ error: "Word is required" }, { status: 400 });
    }

    if (!language) {
      return NextResponse.json(
        { error: "Language is required" },
        { status: 400 }
      );
    }

    const rateLimited = await enforceAiRateLimit(
      payload.userId,
      "pronunciation",
    );
    if (rateLimited) return rateLimited;

    // Reserve coins before the paid AI call (concurrency-safe); throws
    // InsufficientCoinsError (handled below as 402) without any external call.
    const remainingCoins = await deductCoins(
      payload.userId,
      COIN_COSTS.PRONUNCIATION_GENERATION,
      COIN_TRANSACTION_TYPES.pronunciationGeneration,
    );

    // Use a lightweight model for pronunciation generation
    const modelName = "gpt-4o-mini";

    const prompt = `Provide the phonetic pronunciation of the word "${word.trim()}" in ${language}.
Return only the pronunciation in IPA (International Phonetic Alphabet) format, typically enclosed in forward slashes like /həˈloʊ/.
Do not include any explanations, context, or additional text - just the pronunciation.`;

    let pronunciation: string | undefined;
    try {
      const openai = await getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content:
              "You are a language pronunciation assistant. Return only the IPA pronunciation in forward slashes, no additional text or explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent pronunciations
        max_tokens: 30, // Pronunciation shouldn't need many tokens
      });

      pronunciation = completion.choices[0]?.message?.content?.trim();

      if (!pronunciation) {
        throw new Error("No pronunciation received from AI");
      }
    } catch (aiError) {
      await addCoins(
        payload.userId,
        COIN_COSTS.PRONUNCIATION_GENERATION,
        COIN_TRANSACTION_TYPES.pronunciationGeneration,
      ).catch(() => undefined);
      throw aiError;
    }

    // Clean up the pronunciation (ensure it has slashes if missing)
    let cleanPronunciation = pronunciation.trim();

    // Remove any extra text and ensure proper format
    if (!cleanPronunciation.startsWith("/")) {
      cleanPronunciation = "/" + cleanPronunciation;
    }
    if (!cleanPronunciation.endsWith("/")) {
      cleanPronunciation = cleanPronunciation + "/";
    }

    // If the response contains multiple lines or extra text, take the first meaningful part
    const lines = cleanPronunciation.split("\n");
    if (lines.length > 1) {
      cleanPronunciation = lines[0].trim();
    }

    return NextResponse.json(
      { pronunciation: cleanPronunciation, remainingCoins },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json(
        {
          error: `Insufficient AI coins. This operation costs ${error.requiredCoins} AI coins, but you only have ${error.currentCoins} AI coins.`,
        },
        { status: 402 },
      );
    }
    console.error("Error generating pronunciation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate pronunciation",
      },
      { status: 500 }
    );
  }
}
