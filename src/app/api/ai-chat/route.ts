import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import {
  addCoins,
  COIN_TRANSACTION_TYPES,
  deductCoins,
  InsufficientCoinsError,
} from "@/lib/coins";
import { COIN_COSTS } from "@/lib/coin-costs";
import { chatContainsBlockedContent } from "@/lib/chatContentFilter";
import {
  isContentViolationBlocked,
  setContentViolationBlock,
} from "@/lib/rateLimit";
import { enforceAiRateLimit } from "@/lib/aiGuard";

// Bound the input so a fixed-price chat cannot drive an outsized OpenAI bill.
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_MESSAGE_LENGTH = 4000;

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

interface ChatRequest {
  message: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

// POST - Chat with AI helper
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const violation = await isContentViolationBlocked(
      request,
      payload.userId
    );
    if (violation.blocked) {
      return NextResponse.json(
        {
          error:
            "Live chat and the AI helper are paused for a few minutes after a blocked message. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(violation.retryAfterSeconds),
          },
        }
      );
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

    let body: ChatRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { message, conversationHistory = [] } = body;

    // Validate input
    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (
      message.length > MAX_MESSAGE_LENGTH ||
      conversationHistory.length > MAX_HISTORY_MESSAGES ||
      conversationHistory.some(
        (msg) => (msg?.content?.length ?? 0) > MAX_HISTORY_MESSAGE_LENGTH,
      )
    ) {
      return NextResponse.json(
        { error: "Message or conversation history is too long." },
        { status: 400 }
      );
    }

    // Local content moderation (dictionary only — no moderation AI API)
    if (chatContainsBlockedContent(message, conversationHistory)) {
      await setContentViolationBlock(request, payload.userId);
      return NextResponse.json(
        {
          error:
            "Your message does not meet our community guidelines. Live chat and the AI helper are unavailable for 5 minutes.",
        },
        { status: 400 }
      );
    }

    const rateLimited = await enforceAiRateLimit(payload.userId, "chat");
    if (rateLimited) return rateLimited;

    // Reserve coins before the paid AI call (concurrency-safe); throws
    // InsufficientCoinsError (handled below as 402) without any external call.
    const remainingCoins = await deductCoins(
      payload.userId,
      COIN_COSTS.AI_CHAT,
      COIN_TRANSACTION_TYPES.aiChat,
    );

    // Use gpt-4o-mini for cost efficiency
    const modelName = "gpt-4o-mini";

    // Build conversation messages
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content:
          "You are a specialized AI language learning assistant for Duocards, a flashcard learning application. Your ONLY purpose is to help users with language learning, vocabulary, words, flashcards, translations, pronunciations, study techniques for language learning, and questions about using the Duocards app features. You MUST politely decline and redirect any questions about topics unrelated to language learning, vocabulary, or flashcards (such as general knowledge, current events, coding, math, science, etc.). Always redirect off-topic questions back to language learning. Be friendly, concise, and helpful. Focus exclusively on helping users learn languages and improve their vocabulary.",
      },
    ];

    // Add conversation history
    conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // Add current message
    messages.push({
      role: "user",
      content: message.trim(),
    });

    let response: string | undefined;
    try {
      const openai = await getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: modelName,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      response = completion.choices[0]?.message?.content?.trim();

      if (!response) {
        throw new Error("No response received from AI");
      }
    } catch (aiError) {
      await addCoins(
        payload.userId,
        COIN_COSTS.AI_CHAT,
        COIN_TRANSACTION_TYPES.aiChat,
      ).catch(() => undefined);
      throw aiError;
    }

    return NextResponse.json({ response, remainingCoins }, { status: 200 });
  } catch (error) {
    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json(
        {
          error: `Insufficient AI coins. This operation costs ${error.requiredCoins} AI coins, but you only have ${error.currentCoins} AI coins.`,
        },
        { status: 402 },
      );
    }
    console.error("Error in AI chat:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get AI response",
      },
      { status: 500 }
    );
  }
}
