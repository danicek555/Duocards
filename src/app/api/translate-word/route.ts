import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { checkCoins, deductCoins } from "@/lib/coins";
import { COIN_COSTS } from "@/lib/coin-costs";

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
          error: `Insufficient AI coins. This operation costs ${COIN_COSTS.WORD_TRANSLATION} AI coin, but you only have ${coinCheck.currentCoins} AI coins. Please purchase more AI coins.`,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Use a lightweight model for single word translation
    const modelName = "gpt-4o-mini";

    // Detect if input is a phrase (contains spaces or multiple words)
    const trimmedWord = word.trim();
    const isPhrase =
      trimmedWord.includes(" ") || trimmedWord.split(/\s+/).length > 1;

    // Build prompt based on translation modes
    let prompt = "";
    let systemMessage = "";
    let maxTokens = 50;

    if (translateToOneWord && translateToPhrase) {
      // Both modes: return "word: phrase" format
      if (isPhrase) {
        // Input is a phrase - translate the whole phrase and provide explanation
        prompt = `Translate the phrase "${trimmedWord}" from ${fromLanguage} to ${toLanguage}. 
Return the translation in this exact format: "phrase_translation: brief_explanation"
- The phrase translation should be the complete translation of the entire phrase
- The explanation should be a brief note about the phrase's meaning or usage in ${toLanguage}
- Format: "translation: explanation" (with colon and space between them)
- Return only this format, nothing else.`;
        maxTokens = 200;
      } else {
        // Input is a single word
        prompt = `Translate the word "${trimmedWord}" from ${fromLanguage} to ${toLanguage}. 
Return the translation in this exact format: "single_word_translation: phrase_explaining_the_word"
- The single word translation should be just one word (or the most concise translation)
- The phrase should be a brief explanation or example phrase showing how the word is used in ${toLanguage}
- Format: "word: phrase" (with colon and space between them)
- Return only this format, nothing else.`;
        maxTokens = 150;
      }
      systemMessage =
        "You are a language translation assistant. Return translations in the format 'word: phrase' when both are requested.";
    } else if (translateToPhrase) {
      // Only phrase mode
      if (isPhrase) {
        // Input is a phrase - translate the whole phrase
        prompt = `Translate the phrase "${trimmedWord}" from ${fromLanguage} to ${toLanguage}.
Return the complete translation of the entire phrase, nothing else.`;
        maxTokens = 150;
      } else {
        // Input is a single word - provide phrase explanation
        prompt = `Translate the word "${trimmedWord}" from ${fromLanguage} to ${toLanguage} and provide a brief phrase or explanation showing how it's used in ${toLanguage}.
Return only the phrase/explanation, nothing else.`;
        maxTokens = 100;
      }
      systemMessage =
        "You are a language translation assistant. Return phrase translations or explanations.";
    } else {
      // Only one word mode (default): return single word translation
      if (isPhrase) {
        // Input is a phrase but user wants single word mode - translate as concise as possible
        prompt = `Translate the phrase "${trimmedWord}" from ${fromLanguage} to ${toLanguage}. 
Return the translation of the entire phrase, keeping it as concise as possible.
Do not include any explanations, context, or additional text - just the translation.`;
        maxTokens = 100;
      } else {
        // Input is a single word
        prompt = `Translate the word "${trimmedWord}" from ${fromLanguage} to ${toLanguage}. 
Return only the translation as a single word, nothing else.
Do not include any explanations, context, or additional text - just the translation.`;
        maxTokens = 50;
      }
      systemMessage =
        "You are a language translation assistant. Return only the translation, no additional text or explanations.";
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
