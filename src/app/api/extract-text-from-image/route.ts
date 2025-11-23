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

    // Check if user has enough coins
    const coinCheck = await checkCoins(
      payload.userId,
      COIN_COSTS.OCR_EXTRACTION
    );
    if (!coinCheck.hasEnough) {
      return NextResponse.json(
        {
          error: `Insufficient coins. This operation costs ${COIN_COSTS.OCR_EXTRACTION} coins, but you only have ${coinCheck.currentCoins} coins. Please purchase more coins.`,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Extract base64 data (remove data URL prefix if present)
    let base64Data = imageDataUrl;
    if (imageDataUrl.includes(",")) {
      base64Data = imageDataUrl.split(",")[1];
    }

    // Use GPT-4 Vision for OCR
    const openai = await getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using mini for cost efficiency, can use gpt-4o for better accuracy
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Preserve the original formatting, spacing, and line breaks. Return only the extracted text, nothing else.",
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
      max_tokens: 1000,
    });

    const extractedText = completion.choices[0]?.message?.content?.trim();

    // Check if OpenAI indicates there's no text in the image
    if (!extractedText) {
      // Don't deduct coins if no text was found
      return NextResponse.json(
        { error: "There is no text in the picture" },
        { status: 400 }
      );
    }

    const lowerText = extractedText.toLowerCase();
    const textLength = extractedText.length;

    // Check if this looks like an OpenAI error message (not actual extracted text)
    // OpenAI error messages are typically:
    // 1. Short (less than 100 characters)
    // 2. Start with apology/error phrases
    // 3. Contain specific error patterns

    const startsWithErrorPhrase =
      lowerText.startsWith("i'm sorry") ||
      lowerText.startsWith("i'm unable") ||
      lowerText.startsWith("unable to extract") ||
      lowerText.startsWith("can't extract") ||
      lowerText.startsWith("cannot extract") ||
      lowerText.startsWith("i cannot") ||
      lowerText.startsWith("i don't see");

    const isShortErrorMessage =
      textLength < 100 &&
      (lowerText.includes("unable to extract") ||
        lowerText.includes("can't extract text") ||
        lowerText.includes("cannot extract text") ||
        (lowerText.includes("no text") && lowerText.includes("image")) ||
        lowerText.includes("there is no text in") ||
        (lowerText.includes("i'm sorry") && lowerText.includes("extract")) ||
        (lowerText.includes("sorry, but") && lowerText.includes("extract")) ||
        (lowerText.includes("i don't see") && lowerText.includes("text")));

    // Only treat as error if it's clearly an OpenAI error message, not actual extracted text
    if (startsWithErrorPhrase || isShortErrorMessage) {
      // Don't deduct coins if no text was found
      return NextResponse.json(
        { error: "There is no text in the picture" },
        { status: 400 }
      );
    }

    // Deduct coins after successful extraction
    const remainingCoins = await deductCoins(
      payload.userId,
      COIN_COSTS.OCR_EXTRACTION
    );

    return NextResponse.json(
      { text: extractedText, remainingCoins },
      { status: 200 }
    );
  } catch (error) {
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
