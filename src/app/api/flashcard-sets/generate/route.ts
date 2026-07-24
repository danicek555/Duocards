import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import {
  addCoins,
  COIN_TRANSACTION_TYPES,
  deductCoins,
  InsufficientCoinsError,
} from "@/lib/coins";
import { creditCoinsInTransaction } from "@/lib/coinEconomy";
import { COIN_COSTS } from "@/lib/coin-costs";
import { enforceAiRateLimit } from "@/lib/aiGuard";
import { generatePublicCode } from "@/lib/public-code";
import {
  OPENAI_CHAT_MODEL,
  OPENAI_IMAGE_MODEL,
  OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE,
  chatCompletionSupportsTemperature,
} from "@/lib/openaiModels";
import { generateCheckedFlashcardImage } from "@/lib/openaiImage";

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

interface GenerateRequest {
  level: string;
  topic: string;
  fromLanguage: string;
  toLanguage: string;
  wordCount?: number;
  setName: string;
  tags?: string[];
  includeImage?: boolean;
  includeVoice?: boolean;
  includePronunciation?: boolean;
  includePhrases?: boolean;
  isPublic?: boolean;
  previewCode?: string;
  onlyNewWords?: boolean;
}

// Collapses case, diacritics, punctuation and extra whitespace so that
// "Águila!", "aguila" and " Aguila " all count as the same word.
const normalizeWord = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// Upper bound on how many existing words are listed in the prompt; the
// post-generation filter still checks against the full vocabulary.
const PROMPT_EXCLUSION_LIMIT = 300;

// POST - Generate flashcards using AI
export async function POST(request: NextRequest) {
  // Coins reserved up front for this generation; refunded on any failure or for
  // words dropped by dedup. Tracked at function scope so the catch can refund.
  let coinsReserved = 0;
  let coinsUserId = 0;
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

    // Initialize OpenAI client (after API key check)
    const openai = await getOpenAIClient();

    // Check daily AI generation limit (10 per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const todayGenerations = await prisma.aiGeneration.count({
      where: {
        userId: payload.userId,
        createdAt: {
          gte: today,
        },
      },
    });

    const DAILY_LIMIT = 10;
    if (todayGenerations >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `Daily AI generation limit reached. You can generate flashcards using AI ${DAILY_LIMIT} times per day. Please try again tomorrow.`,
        },
        { status: 429 }
      );
    }

    // Check maximum flashcard sets limit (100)
    const existingSetsCount = await prisma.flashcardSet.count({
      where: { userId: payload.userId },
    });

    if (existingSetsCount >= 100) {
      return NextResponse.json(
        { error: "Maximum 100 flashcard sets allowed" },
        { status: 400 }
      );
    }

    const body: GenerateRequest = await request.json();
    const {
      level,
      topic,
      fromLanguage,
      toLanguage,
      wordCount = 5,
      setName,
      tags = [],
      includeImage = false,
      includeVoice = false,
      includePronunciation = false,
      includePhrases = false,
      isPublic = false,
      previewCode,
      onlyNewWords = true,
    } = body;

    // Validate input
    if (
      !level ||
      !topic ||
      !fromLanguage ||
      !toLanguage ||
      !setName ||
      !setName.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Level, topic, from language, to language, and set name are required",
        },
        { status: 400 }
      );
    }

    if (fromLanguage === toLanguage) {
      return NextResponse.json(
        { error: "From and To languages must be different" },
        { status: 400 }
      );
    }

    if (!wordCount || wordCount < 1 || wordCount > 10) {
      return NextResponse.json(
        { error: "Word count must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Validate topic and setName length (max 20 characters)
    if (topic.trim().length > 20) {
      return NextResponse.json(
        { error: "Topic must be maximum 20 characters" },
        { status: 400 }
      );
    }

    if (setName.trim().length > 20) {
      return NextResponse.json(
        { error: "Set name must be maximum 20 characters" },
        { status: 400 }
      );
    }

    // Use the provided set name (truncate to 20 if needed)
    const flashcardSetName = setName.trim().slice(0, 20);
    const topicTrimmed = topic.trim().slice(0, 20);

    // Calculate coin cost for this generation
    // 1 coin per word for flashcard generation
    let totalCost = wordCount * 1; // 1 coin per word

    if (includeImage) {
      totalCost += wordCount * COIN_COSTS.IMAGE_GENERATION; // Expensive - per image
    }

    if (includeVoice) {
      totalCost += wordCount * COIN_COSTS.AUDIO_GENERATION; // Per audio
    }

    if (includePronunciation) {
      totalCost += wordCount * COIN_COSTS.PRONUNCIATION_GENERATION; // 1 coin per pronunciation
    }

    if (includePhrases) {
      totalCost += wordCount * COIN_COSTS.PHRASE_GENERATION; // 1 coin per example phrase
    }

    const rateLimited = await enforceAiRateLimit(payload.userId, "generate");
    if (rateLimited) return rateLimited;

    // Reserve the full requested cost before any paid AI so concurrent requests
    // cannot spend more OpenAI budget than the balance covers. Throws
    // InsufficientCoinsError (handled in catch as 402) without any external
    // call. Refunded below on failure, and the difference for deduped words is
    // credited back in the final transaction.
    await deductCoins(
      payload.userId,
      totalCost,
      COIN_TRANSACTION_TYPES.flashcardGeneration,
    );
    coinsReserved = totalCost;
    coinsUserId = payload.userId;

    // Words the user already has for this language pair; generated words
    // colliding with them are excluded from the prompt and filtered out
    // after generation.
    const existingNormalized = new Set<string>();
    let promptExclusions: string[] = [];
    if (onlyNewWords) {
      const existingWords = await prisma.word.findMany({
        where: {
          userId: payload.userId,
          flashcardSet: { is: { fromLanguage, toLanguage } },
        },
        select: { word: true },
      });
      for (const existing of existingWords) {
        const key = normalizeWord(existing.word);
        if (key) existingNormalized.add(key);
      }
      promptExclusions = Array.from(existingNormalized).slice(
        0,
        PROMPT_EXCLUSION_LIMIT
      );
    }

    // Create prompt for OpenAI
    let prompt = `Generate ${wordCount} flashcards for translating from ${fromLanguage} to ${toLanguage} at CEFR ${level} level about the topic: "${topicTrimmed}" (max 20 characters).

Return a JSON object with a "flashcards" array containing objects with this exact structure:
{
  "flashcards": [
    {"word": "Word in ${fromLanguage}", "translation": "Translation in ${toLanguage}"${
      includePronunciation
        ? ', "pronunciation": "Phonetic pronunciation guide"'
        : ""
    }${includePhrases ? ', "examplePhrase": "Short example sentence in ' + toLanguage + '"' : ""}${includeImage ? ', "imageScene": "Short visual scene in English"' : ""}},
    {"word": "Another word in ${fromLanguage}", "translation": "Translation in ${toLanguage}"${
      includePronunciation
        ? ', "pronunciation": "Phonetic pronunciation guide"'
        : ""
    }${includePhrases ? ', "examplePhrase": "Short example sentence in ' + toLanguage + '"' : ""}${includeImage ? ', "imageScene": "Short visual scene in English"' : ""}}
  ]
}

Requirements:
- Use appropriate vocabulary for CEFR ${level} level (${
      level === "A1"
        ? "Beginner"
        : level === "A2"
        ? "Elementary"
        : level === "B1"
        ? "Intermediate"
        : level === "B2"
        ? "Upper Intermediate"
        : level === "C1"
        ? "Advanced"
        : "Proficiency"
    })
- Focus on the topic: ${topicTrimmed} (max 20 characters)
- Words should be in ${fromLanguage}
- Translations should be accurate in ${toLanguage}
- IMPORTANT: Avoid cognates (words that look or sound very similar in both languages, like "Gastronomy/Gastronomia" or "Hotel/Hotel"). Choose words that are genuinely challenging to learn and require memorization
- Prioritize words that are distinctly different between ${fromLanguage} and ${toLanguage}
- Make words/phrases practical and useful for language learning`;

    if (includePronunciation) {
      prompt += `\n- Include pronunciation guide in IPA (International Phonetic Alphabet) format for the ${toLanguage} translation`;
    }

    if (includePhrases) {
      prompt += `\n- For every flashcard include "examplePhrase": one short, natural example sentence in ${toLanguage} (max 12 words) that uses the translated word in context`;
    }

    if (includeImage) {
      prompt += `\n- For every flashcard include "imageScene": a simple visual scene in English (8-15 words) that unmistakably depicts the concept; mention only objects, creatures or actions — never letters, words, signs, labels or writing`;
    }

    if (promptExclusions.length > 0) {
      prompt += `\n- CRITICAL: The user already has flashcards for these ${fromLanguage} words, do NOT include any of them or trivial variants of them (plural, different casing or punctuation): ${promptExclusions.join(
        ", "
      )}`;
    }

    prompt += `\n- Return only valid JSON, no additional text or markdown formatting
- Include exactly ${wordCount} flashcards`;

    const modelName = OPENAI_CHAT_MODEL;

    // Some models don't support custom temperature (only default value of 1)
    // Check if we should include temperature parameter
    interface ModelConfig {
      model: string;
      messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
      response_format: { type: "json_object" };
      temperature?: number;
    }

    const modelConfig: ModelConfig = {
      model: modelName,
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
      response_format: { type: "json_object" }, // Force JSON mode
    };

    if (chatCompletionSupportsTemperature(modelName)) {
      modelConfig.temperature = 0.7;
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create(modelConfig);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let words: {
      word: string;
      translation: string;
      pronunciation?: string;
      examplePhrase?: string;
      imageScene?: string;
    }[];
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

      words = parsed as {
        word: string;
        translation: string;
        pronunciation?: string;
        examplePhrase?: string;
        imageScene?: string;
      }[];

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
      await addCoins(
        payload.userId,
        coinsReserved,
        COIN_TRANSACTION_TYPES.flashcardGeneration,
      ).catch(() => undefined);
      coinsReserved = 0;
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Drop duplicates: always within the generated batch, and against the
    // user's existing vocabulary for this language pair when onlyNewWords
    // is enabled. Matching is diacritics/case/punctuation-insensitive.
    const seenNormalized = new Set<string>(existingNormalized);
    words = words.filter((item) => {
      const key = normalizeWord(item.word);
      if (!key || seenNormalized.has(key)) return false;
      seenNormalized.add(key);
      return true;
    });

    if (words.length === 0) {
      await addCoins(
        payload.userId,
        coinsReserved,
        COIN_TRANSACTION_TYPES.flashcardGeneration,
      ).catch(() => undefined);
      coinsReserved = 0;
      return NextResponse.json(
        {
          error:
            "Every generated word duplicates flashcards you already have. Try a different topic, or turn off 'Only new words'. No coins were charged.",
        },
        { status: 422 }
      );
    }

    // Generate images and audio if requested
    const wordsWithExtras = await Promise.all(
      words.map(async (wordPair) => {
        let imageUrl: string | null = null;
        let audioUrl: string | null = null;

        // Generate image if requested
        if (includeImage) {
          try {
            // The scene comes from the flashcard batch when the model
            // provided one; otherwise fall back to a plain concept phrase.
            const scene =
              wordPair.imageScene?.trim() ||
              `a simple depiction of ${wordPair.translation}`;
            const checked = await generateCheckedFlashcardImage(
              openai,
              OPENAI_IMAGE_MODEL,
              scene
            );
            imageUrl = checked.imageUrl;
          } catch (imageError) {
            console.error("Error generating image:", imageError);
            // Continue without image if generation fails
          }
        }

        // Generate audio if requested
        if (includeVoice) {
          try {
            const translationText = wordPair.translation?.trim();
            if (!translationText) {
              console.warn(
                `Skipping audio: empty translation for "${wordPair.word}"`
              );
            } else {
              const audioResponse = await openai.audio.speech.create({
                model: OPENAI_TTS_MODEL,
                voice: OPENAI_TTS_VOICE,
                input: translationText,
              });

              const audioBuffer = await audioResponse.arrayBuffer();

              if (!audioBuffer || audioBuffer.byteLength === 0) {
                console.error(`Empty audio buffer for "${wordPair.word}"`);
              } else {
                const base64Audio = Buffer.from(audioBuffer).toString("base64");

                if (base64Audio.length < 1000) {
                  console.error(
                    `Audio too short for "${wordPair.word}" (${base64Audio.length} chars)`
                  );
                } else {
                  audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
                }
              }
            }
          } catch (audioError) {
            console.error(
              `Audio generation failed for "${wordPair.word}":`,
              audioError instanceof Error ? audioError.message : audioError
            );
            // Continue without audio if generation fails
          }
        }

        return {
          ...wordPair,
          imageUrl,
          audioUrl,
        };
      })
    );

    // Create images and audio records
    // Note: Creating individual records shouldn't hit the 5MB limit (only fetching many does)
    const wordsWithImageAndAudioIds = await Promise.all(
      wordsWithExtras.map(async (wordPair) => {
        let imageId: number | undefined;
        let audioId: number | undefined;

        // Create image record if exists
        if (wordPair.imageUrl) {
          const mimeType = wordPair.imageUrl.startsWith("data:")
            ? wordPair.imageUrl.split(";")[0].split(":")[1] || "image/png"
            : "image/png";
          // Prisma client types may not recognize wordImage, but it works at runtime
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const image = await (prisma as any).wordImage.create({
            data: {
              dataUrl: wordPair.imageUrl,
              mimeType: mimeType,
            },
          });
          imageId = image.id;
        }

        // Create audio record if exists
        if (wordPair.audioUrl) {
          const mimeType = wordPair.audioUrl.startsWith("data:")
            ? wordPair.audioUrl.split(";")[0].split(":")[1] || "audio/mpeg"
            : "audio/mpeg";
          // Prisma client types may not recognize wordAudio, but it works at runtime
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const audio = await (prisma as any).wordAudio.create({
            data: {
              dataUrl: wordPair.audioUrl,
              mimeType: mimeType,
            },
          });
          audioId = audio.id;
        }

        return {
          ...wordPair,
          imageId,
          audioId,
        };
      })
    );

    // Validate tags
    let tagsArray = Array.isArray(tags)
      ? tags.filter((tag: string) => tag.trim())
      : [];

    // Add "public" tag if set is public, remove it if not
    if (isPublic === true) {
      if (!tagsArray.includes("public")) {
        tagsArray.push("public");
      }
    } else {
      tagsArray = tagsArray.filter((tag: string) => tag !== "public");
    }

    if (tagsArray.length > 5) {
      await addCoins(
        payload.userId,
        coinsReserved,
        COIN_TRANSACTION_TYPES.flashcardGeneration,
      ).catch(() => undefined);
      coinsReserved = 0;
      return NextResponse.json(
        { error: "Maximum 5 tags allowed per flashcard set" },
        { status: 400 }
      );
    }

    // Check unique tags limit (20 different tags across all sets)
    const allExistingSets = await prisma.flashcardSet.findMany({
      where: { userId: payload.userId },
    });
    // Collect all unique tags from existing sets
    const existingUniqueTags = new Set<string>();
    allExistingSets.forEach((set) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setTags = (set as any).tags || [];
      setTags.forEach((tag: string) => {
        if (tag.trim()) {
          existingUniqueTags.add(tag.trim());
        }
      });
    });

    // Combine user tags with "AI Generated" tag
    const aiGeneratedTag = "AI Generated";
    const allTagsToAdd = new Set([...tagsArray, aiGeneratedTag]);

    // Note: "public" tag is already added to tagsArray above if isPublic is true

    // Count how many new unique tags are being added
    const newUniqueTags = Array.from(allTagsToAdd).filter(
      (tag: string) => !existingUniqueTags.has(tag.trim())
    );
    const uniqueTagsCount = existingUniqueTags.size + newUniqueTags.length;

    if (uniqueTagsCount > 20) {
      await addCoins(
        payload.userId,
        coinsReserved,
        COIN_TRANSACTION_TYPES.flashcardGeneration,
      ).catch(() => undefined);
      coinsReserved = 0;
      return NextResponse.json(
        {
          error: `Maximum 20 different tags allowed across all sets. You currently have ${existingUniqueTags.size} unique tags across all sets.`,
        },
        { status: 400 }
      );
    }

    // Use preview code if provided, otherwise generate new one, or set to null if not public
    let publicCode: string | null = null;
    if (isPublic === true) {
      if (previewCode && typeof previewCode === "string") {
        // Use the preview code that was shown to the user
        // Verify it's unique (in case of race condition)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = await (prisma.flashcardSet.findUnique as any)({
          where: { publicCode: previewCode },
          select: { id: true },
        });
        if (existing) {
          // If code already exists, generate a new one
          publicCode = await generatePublicCode();
        } else {
          publicCode = previewCode;
        }
      } else {
        publicCode = await generatePublicCode();
      }
    } else {
      publicCode = null; // Explicitly remove code if not public
    }

    // Create flashcard set with words and record AI generation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // The full requested cost was already reserved before generation. Charge
      // only for what was actually created — dedup may have dropped some of the
      // requested words — by crediting the difference back inside this
      // transaction so the set creation and the refund commit atomically.
      const perWordCost =
        1 +
        (includeImage ? COIN_COSTS.IMAGE_GENERATION : 0) +
        (includeVoice ? COIN_COSTS.AUDIO_GENERATION : 0) +
        (includePronunciation ? COIN_COSTS.PRONUNCIATION_GENERATION : 0) +
        (includePhrases ? COIN_COSTS.PHRASE_GENERATION : 0);
      const finalCost = wordsWithImageAndAudioIds.length * perWordCost;
      const overReserved = coinsReserved - finalCost;

      if (overReserved > 0) {
        await creditCoinsInTransaction(
          tx,
          payload.userId,
          overReserved,
          COIN_TRANSACTION_TYPES.flashcardGeneration,
        );
      }

      // Create words with references to images and audio
      const wordsToCreate = wordsWithImageAndAudioIds.map((wordPair) => {
        const wordData: {
          word: string;
          translation: string;
          difficulty: number;
          userId: number;
          pronunciation?: string;
          imageId?: number;
          audioId?: number;
        } = {
          word: wordPair.word.trim(),
          // Store the example phrase in the "translation: phrase" form so the
          // flashcard renders the phrase on its own line below the translation
          // (the same format the manual per-word phrase translation produces).
          translation:
            includePhrases && wordPair.examplePhrase?.trim()
              ? `${wordPair.translation.trim()}: ${wordPair.examplePhrase.trim()}`
              : wordPair.translation.trim(),
          difficulty: 1,
          userId: payload.userId,
        };

        if (includePronunciation && wordPair.pronunciation) {
          wordData.pronunciation = wordPair.pronunciation.trim();
        }

        if (wordPair.imageId) {
          wordData.imageId = wordPair.imageId;
        }

        if (wordPair.audioId) {
          wordData.audioId = wordPair.audioId;
        }

        return wordData;
      });

      // Create flashcard set
      // Exclude image and audio data from response to avoid exceeding 5MB limit
      const flashcardSet = await tx.flashcardSet.create({
        data: {
          name: flashcardSetName,
          userId: payload.userId,
          fromLanguage: fromLanguage,
          toLanguage: toLanguage,
          isAIGenerated: true,
          tags: Array.from(allTagsToAdd), // Combine user tags with AI Generated tag
          isPublic: isPublic === true,
          publicCode: publicCode,
          words: {
            create: wordsToCreate,
          },
        },
        select: {
          id: true,
          name: true,
          userId: true,
          fromLanguage: true,
          toLanguage: true,
          isAIGenerated: true,
          isPublic: true,
          publicCode: true,
          createdAt: true,
          updatedAt: true,
          words: {
            select: {
              id: true,
              word: true,
              translation: true,
              pronunciation: true,
              difficulty: true,
              imageId: true,
              audioId: true,
              // Exclude image and audio data URLs to avoid exceeding response size limit
            },
          },
        },
      });

      // Record AI generation
      await tx.aiGeneration.create({
        data: {
          userId: payload.userId,
        },
      });

      return flashcardSet;
    });

    // Net charge is now settled (reserved minus the credited difference).
    coinsReserved = 0;

    return NextResponse.json(
      {
        flashcardSet: result,
        message: `Successfully generated ${words.length} flashcards!`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // Refund any coins still reserved when generation failed after reservation.
    if (coinsReserved > 0 && coinsUserId > 0) {
      await addCoins(
        coinsUserId,
        coinsReserved,
        COIN_TRANSACTION_TYPES.flashcardGeneration,
      ).catch(() => undefined);
      coinsReserved = 0;
    }

    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json(
        {
          error: `Insufficient AI coins. This operation costs ${error.requiredCoins} AI coins, but you only have ${error.currentCoins} AI coins.`,
        },
        { status: 402 },
      );
    }

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
