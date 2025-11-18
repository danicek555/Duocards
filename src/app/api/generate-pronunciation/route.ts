import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import OpenAI from "openai";
import { checkCoins, deductCoins, COIN_COSTS } from "@/lib/coins";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Check if user has enough coins
    const coinCheck = await checkCoins(
      payload.userId,
      COIN_COSTS.PRONUNCIATION_GENERATION
    );
    if (!coinCheck.hasEnough) {
      return NextResponse.json(
        {
          error: `Insufficient coins. This operation costs ${COIN_COSTS.PRONUNCIATION_GENERATION} coin, but you only have ${coinCheck.currentCoins} coins. Please purchase more coins.`,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Use a lightweight model for pronunciation generation
    const modelName = "gpt-4o-mini";

    const prompt = `Provide the phonetic pronunciation of the word "${word.trim()}" in ${language}. 
Return only the pronunciation in IPA (International Phonetic Alphabet) format, typically enclosed in forward slashes like /həˈloʊ/.
Do not include any explanations, context, or additional text - just the pronunciation.`;

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

    const pronunciation = completion.choices[0]?.message?.content?.trim();

    if (!pronunciation) {
      throw new Error("No pronunciation received from AI");
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

    // Deduct coins after successful pronunciation generation
    const remainingCoins = await deductCoins(
      payload.userId,
      COIN_COSTS.PRONUNCIATION_GENERATION
    );

    return NextResponse.json(
      { pronunciation: cleanPronunciation, remainingCoins },
      { status: 200 }
    );
  } catch (error) {
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
