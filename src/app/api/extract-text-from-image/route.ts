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

// Cap the uploaded image so a fixed-price OCR call cannot drive an outsized
// OpenAI bill. ~10 MB of base64 (~7.5 MB decoded) is plenty for a book page.
const MAX_IMAGE_DATA_URL_LENGTH = 10_000_000;

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

interface ExtractTextRequest {
  imageDataUrl: string; // Base64 encoded image
}

// POST - Extract text from image using OpenAI Vision API
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

    let body: ExtractTextRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { imageDataUrl } = body;

    // Validate input
    if (!imageDataUrl || !imageDataUrl.trim()) {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json(
        { error: "Image is too large." },
        { status: 400 }
      );
    }

    const rateLimited = await enforceAiRateLimit(payload.userId, "ocr");
    if (rateLimited) return rateLimited;

    // Reserve coins before the paid AI call (concurrency-safe); throws
    // InsufficientCoinsError (handled below as 402) without any external call.
    // Refunded below when no usable text is extracted or the call fails.
    const remainingCoins = await deductCoins(
      payload.userId,
      COIN_COSTS.OCR_EXTRACTION,
      COIN_TRANSACTION_TYPES.ocrExtraction,
    );
    const refundOcr = () =>
      addCoins(
        payload.userId,
        COIN_COSTS.OCR_EXTRACTION,
        COIN_TRANSACTION_TYPES.ocrExtraction,
      ).catch(() => undefined);

    // Extract base64 data (remove data URL prefix if present)
    let base64Data = imageDataUrl;
    if (imageDataUrl.includes(",")) {
      base64Data = imageDataUrl.split(",")[1];
    }

    // Use GPT-4 Vision for OCR
    let extractedText: string | undefined;
    let finishReason: string | null | undefined;
    try {
      const openai = await getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Using mini for cost efficiency
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract ALL text from this image completely from top to bottom, left to right. Do not truncate, skip, or stop early. Extract every single word, sentence, and paragraph visible in the image. Continue extracting until you have captured ALL text in the image, even if it's very long. Preserve the original formatting, spacing, and line breaks. Return only the extracted text, nothing else. Do not stop after just a few lines - extract everything.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        max_tokens: 16000, // Increased to handle very long book pages (GPT-4o-mini supports up to 128k tokens)
        temperature: 0, // Use deterministic output to ensure complete extraction
      });

      const choice = completion.choices[0];
      extractedText = choice?.message?.content?.trim();
      finishReason = choice?.finish_reason;
    } catch (aiError) {
      await refundOcr();
      throw aiError;
    }

    // Log for debugging
    console.log("OCR Response:", {
      finishReason,
      textLength: extractedText?.length || 0,
      textPreview: extractedText?.substring(0, 100) || "empty",
    });

    // Check if response was truncated due to token limit
    if (finishReason === "length") {
      console.warn(
        "OCR response was truncated due to token limit. Consider increasing max_tokens or splitting the image."
      );
      // Still return the text, but it's incomplete
    }

    // Check if OpenAI indicates there's no text in the image
    if (!extractedText || extractedText.length === 0) {
      console.log("No text extracted from image");
      // No usable text — refund the reserved coins.
      await refundOcr();
      return NextResponse.json(
        { error: "There is no text in the picture" },
        { status: 400 }
      );
    }

    const lowerText = extractedText.toLowerCase();
    const textLength = extractedText.length;

    // Check if this looks like an OpenAI error message (not actual extracted text)
    // Be very conservative - only flag obvious error messages
    // OpenAI error messages typically:
    // 1. Are very short (less than 50 characters)
    // 2. Contain specific error phrases about extraction/image
    // 3. Don't look like actual book content

    // Only flag if it's VERY short AND contains clear error phrases about extraction
    const isObviousErrorMessage =
      textLength < 50 &&
      (lowerText.includes("unable to extract text from") ||
        lowerText.includes("cannot extract text from") ||
        lowerText.includes("can't extract text from") ||
        lowerText.includes("there is no text in the image") ||
        lowerText.includes("i don't see any text in this image") ||
        (lowerText.includes("i'm sorry") &&
          lowerText.includes("extract text") &&
          lowerText.includes("image")) ||
        (lowerText.startsWith("i'm unable to") &&
          lowerText.includes("extract")));

    // Only treat as error if it's clearly an OpenAI error message
    // Be very conservative - actual book text should never be flagged
    if (isObviousErrorMessage) {
      // No usable text — refund the reserved coins.
      await refundOcr();
      return NextResponse.json(
        { error: "There is no text in the picture" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { text: extractedText, remainingCoins },
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
    console.error("Error extracting text from image:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract text from image",
      },
      { status: 500 }
    );
  }
}
