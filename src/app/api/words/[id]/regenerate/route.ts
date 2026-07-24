import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import { addCoins, COIN_TRANSACTION_TYPES, deductCoins } from "@/lib/coins";
import { COIN_COSTS } from "@/lib/coin-costs";
import { enforceAiRateLimit } from "@/lib/aiGuard";
import { OPENAI_CHAT_MODEL, OPENAI_IMAGE_MODEL } from "@/lib/openaiModels";
import {
  describeImageScene,
  generateCheckedFlashcardImage,
} from "@/lib/openaiImage";

// Initialize OpenAI client lazily to avoid build-time errors
async function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// POST - Regenerate a single word's image or translation when the AI
// produced a bad one. Charges the same per-item coin cost as generation.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth")?.value;
    const payload = await verifyAuthToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const wordId = parseInt(id, 10);
    if (Number.isNaN(wordId)) {
      return NextResponse.json({ error: "Invalid word id" }, { status: 400 });
    }

    const body: { type?: string } = await request.json();
    const type = body.type;
    if (type !== "image" && type !== "translation") {
      return NextResponse.json(
        { error: "type must be 'image' or 'translation'" },
        { status: 400 }
      );
    }

    const word = await prisma.word.findFirst({
      where: { id: wordId, userId: payload.userId },
      include: { flashcardSet: { select: { toLanguage: true, fromLanguage: true } } },
    });

    if (!word) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    const cost =
      type === "image"
        ? COIN_COSTS.IMAGE_GENERATION
        : COIN_COSTS.WORD_TRANSLATION;
    const coinType =
      type === "image"
        ? COIN_TRANSACTION_TYPES.flashcardGeneration
        : COIN_TRANSACTION_TYPES.wordTranslation;

    const rateLimited = await enforceAiRateLimit(payload.userId, "regenerate");
    if (rateLimited) return rateLimited;

    // Reserve coins before the paid AI call so concurrent requests cannot spend
    // more OpenAI budget than the balance covers. Throws InsufficientCoinsError
    // (handled below as 402) without any external call. Refunded on any failure.
    await deductCoins(payload.userId, cost, coinType);

    const refund = () =>
      addCoins(payload.userId, cost, coinType).catch(() => undefined);

    try {
      const openai = await getOpenAIClient();
      const toLanguage = word.flashcardSet?.toLanguage || "the target language";
      const fromLanguage =
        word.flashcardSet?.fromLanguage || "the source language";

      if (type === "image") {
        // Describe the concept as a scene first so the image prompt never
        // contains the quoted word (main source of residual text in images).
        const scene = await describeImageScene(
          openai,
          word.translation,
          toLanguage
        );
        const { imageUrl } = await generateCheckedFlashcardImage(
          openai,
          OPENAI_IMAGE_MODEL,
          scene
        );

        if (!imageUrl) {
          await refund();
          return NextResponse.json(
            { error: "Image generation failed. No coins were charged." },
            { status: 502 }
          );
        }

        const mimeType = imageUrl.startsWith("data:")
          ? imageUrl.split(";")[0].split(":")[1] || "image/png"
          : "image/png";

        const oldImageId = word.imageId;
        const newImageId = await prisma.$transaction(async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const image = await (tx as any).wordImage.create({
            data: { dataUrl: imageUrl, mimeType },
          });
          await tx.word.update({
            where: { id: word.id },
            data: { imageId: image.id },
          });
          if (oldImageId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).wordImage.delete({ where: { id: oldImageId } });
          }
          return image.id as number;
        });

        return NextResponse.json({ success: true, type, imageId: newImageId });
      }

      // type === "translation"
      // The card's front may be a whole phrase/sentence, and the translation
      // may carry an example in the "translation: example sentence" form. Keep
      // that shape when regenerating so a sentence is not silently dropped.
      const sourceIsPhrase = word.word.trim().split(/\s+/).length > 1;
      const translationHasExample = /:\s/.test(word.translation);
      const wantsPhrase = sourceIsPhrase || translationHasExample;

      const prompt = wantsPhrase
        ? `Translate the ${fromLanguage} text "${word.word}" into ${toLanguage}. The previous translation "${word.translation}" was wrong or low quality. If the text is a single word, return it as "translation: a short natural example sentence in ${toLanguage}". If it is a phrase or full sentence, return the complete natural ${toLanguage} translation of the whole thing (keep the sentence, do not shorten to one word). Return ONLY the result, no quotes, no explanation.`
        : `Translate the ${fromLanguage} word "${word.word}" into ${toLanguage}. The previous translation "${word.translation}" was wrong or low quality — provide the most accurate, natural translation instead. Return ONLY the translation text, no quotes, no explanation.`;

      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: "user", content: prompt }],
      });

      const newTranslation = completion.choices[0]?.message?.content?.trim();
      if (!newTranslation) {
        await refund();
        return NextResponse.json(
          { error: "Translation failed. No coins were charged." },
          { status: 502 }
        );
      }

      // Allow room for a sentence, matching the create/translate flow's limit.
      const storedTranslation = newTranslation.slice(0, 2000);

      await prisma.word.update({
        where: { id: word.id },
        data: { translation: storedTranslation },
      });

      return NextResponse.json({
        success: true,
        type,
        translation: storedTranslation,
      });
    } catch (aiError) {
      await refund();
      throw aiError;
    }
  } catch (error) {
    console.error("Error regenerating word content:", error);
    return NextResponse.json(
      { error: "Failed to regenerate. Please try again." },
      { status: 500 }
    );
  }
}
