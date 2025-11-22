import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { checkCoins, deductCoins, COIN_COSTS } from "@/lib/coins";

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

interface TranslateRequest {
  word: string;
  fromLanguage: string;
  toLanguage: string;
  translateToOneWord?: boolean;
  translateToPhrase?: boolean;
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
    const {
      word,
      fromLanguage,
      toLanguage,
      translateToOneWord = true,
      translateToPhrase = false,
    } = body;

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

    // Check if user has enough coins
    const coinCheck = await checkCoins(
      payload.userId,
      COIN_COSTS.WORD_TRANSLATION
    );
    if (!coinCheck.hasEnough) {
      return NextResponse.json(
        {
          error: `Insufficient coins. This operation costs ${COIN_COSTS.WORD_TRANSLATION} coin, but you only have ${coinCheck.currentCoins} coins. Please purchase more coins.`,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Use a lightweight model for single word translation
    const modelName = "gpt-4o-mini";

    // Build prompt based on translation modes
    let prompt = "";
    let systemMessage = "";
    let maxTokens = 50;

    if (translateToOneWord && translateToPhrase) {
      // Both modes: return "word: phrase" format
      prompt = `Translate the word "${word.trim()}" from ${fromLanguage} to ${toLanguage}. 
Return the translation in this exact format: "single_word_translation: phrase_explaining_the_word"
- The single word translation should be just one word (or the most concise translation)
- The phrase should be a brief explanation or example phrase showing how the word is used in ${toLanguage}
- Format: "word: phrase" (with colon and space between them)
- Return only this format, nothing else.`;
      systemMessage =
        "You are a language translation assistant. Return translations in the format 'word: phrase' when both are requested.";
      maxTokens = 150; // More tokens needed for phrase
    } else if (translateToPhrase) {
      // Only phrase mode: return phrase explaining the word
      prompt = `Translate the word "${word.trim()}" from ${fromLanguage} to ${toLanguage} and provide a brief phrase or explanation showing how it's used in ${toLanguage}.
Return only the phrase/explanation, nothing else.`;
      systemMessage =
        "You are a language translation assistant. Return phrase explanations for words.";
      maxTokens = 100; // More tokens for phrase
    } else {
      // Only one word mode (default): return single word translation
      prompt = `Translate the word "${word.trim()}" from ${fromLanguage} to ${toLanguage}. 
Return only the translation as a single word, nothing else. If the word is a phrase or multiple words, translate it as a whole but keep it concise.
Do not include any explanations, context, or additional text - just the translation.`;
      systemMessage =
        "You are a language translation assistant. Return only the translation, no additional text or explanations.";
      maxTokens = 50;
    }

    const openai = await getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent translations
      max_tokens: maxTokens,
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

    // Deduct coins after successful translation
    const remainingCoins = await deductCoins(
      payload.userId,
      COIN_COSTS.WORD_TRANSLATION
    );

    return NextResponse.json(
      { translation: cleanTranslation, remainingCoins },
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
