import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateRequest {
  level: string;
  topic: string;
  fromLanguage: string;
  toLanguage: string;
  wordCount?: number;
  setName: string;
  includeImage?: boolean;
  includeVoice?: boolean;
  includePronunciation?: boolean;
}

// POST - Generate flashcards using AI
export async function POST(request: NextRequest) {
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

    // Check daily AI generation limit (10 per day)
    // Note: Uncomment this section if you add AiGeneration model to your schema
    /*
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
    */

    const body: GenerateRequest = await request.json();
    const {
      level,
      topic,
      fromLanguage,
      toLanguage,
      wordCount = 5,
      setName,
      includeImage = false,
      includeVoice = false,
      includePronunciation = false,
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

    // Use the provided set name
    const flashcardSetName = setName.trim();

    // Create prompt for OpenAI
    let prompt = `Generate ${wordCount} flashcards for translating from ${fromLanguage} to ${toLanguage} at CEFR ${level} level about the topic: "${topic}".

Return a JSON object with a "flashcards" array containing objects with this exact structure:
{
  "flashcards": [
    {"word": "Word in ${fromLanguage}", "translation": "Translation in ${toLanguage}"${
      includePronunciation
        ? ', "pronunciation": "Phonetic pronunciation guide"'
        : ""
    }},
    {"word": "Another word in ${fromLanguage}", "translation": "Translation in ${toLanguage}"${
      includePronunciation
        ? ', "pronunciation": "Phonetic pronunciation guide"'
        : ""
    }}
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
- Focus on the topic: ${topic}
- Words should be in ${fromLanguage}
- Translations should be accurate in ${toLanguage}
- IMPORTANT: Avoid cognates (words that look or sound very similar in both languages, like "Gastronomy/Gastronomia" or "Hotel/Hotel"). Choose words that are genuinely challenging to learn and require memorization
- Prioritize words that are distinctly different between ${fromLanguage} and ${toLanguage}
- Make words/phrases practical and useful for language learning`;

    if (includePronunciation) {
      prompt += `\n- Include pronunciation guide in IPA (International Phonetic Alphabet) format for the ${toLanguage} translation`;
    }

    prompt += `\n- Return only valid JSON, no additional text or markdown formatting
- Include exactly ${wordCount} flashcards`;

    // Determine which model to use based on available models
    // Use gpt-4o-mini as it supports temperature and is cost-effective
    const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

    // Only add temperature if the model supports it (most models do, but some like gpt-5-nano don't)
    // gpt-4o-mini supports temperature, so we include it
    if (!modelName.includes("gpt-5-nano") && !modelName.includes("gpt-5")) {
      modelConfig.temperature = 0.7;
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create(modelConfig);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let words: { word: string; translation: string; pronunciation?: string }[];
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
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
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
            const imageResponse = await openai.images.generate({
              model: "dall-e-3",
              prompt: `A simple, clear illustration representing the word "${wordPair.translation}" in ${toLanguage}. The image should be educational and suitable for language learning flashcards.`,
              n: 1,
              size: "1024x1024",
            });
            imageUrl = imageResponse.data?.[0]?.url || null;
          } catch (imageError) {
            console.error("Error generating image:", imageError);
            // Continue without image if generation fails
          }
        }

        // Generate audio if requested
        if (includeVoice) {
          try {
            const audioResponse = await openai.audio.speech.create({
              model: "tts-1",
              voice: "alloy",
              input: wordPair.translation,
            });
            // For now, we'll store a placeholder - in production, you'd upload to S3 or similar
            // For demo purposes, we could use a service like Google Translate TTS or save locally
            audioUrl = `data:audio/mpeg;base64,${Buffer.from(
              await audioResponse.arrayBuffer()
            ).toString("base64")}`;
            // Note: In production, upload audio to a storage service and store the URL
          } catch (audioError) {
            console.error("Error generating audio:", audioError);
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

    // Create flashcard set with words and record AI generation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create flashcard set
      const flashcardSet = await tx.flashcardSet.create({
        data: {
          name: flashcardSetName,
          userId: payload.userId,
          fromLanguage: fromLanguage,
          toLanguage: toLanguage,
          isAIGenerated: true,
          words: {
            create: wordsWithExtras.map((wordPair) => {
              const wordData: {
                word: string;
                translation: string;
                difficulty: number;
                userId: number;
                pronunciation?: string;
                imageUrl?: string;
                audioUrl?: string;
              } = {
                word: wordPair.word.trim(),
                translation: wordPair.translation.trim(),
                difficulty: 1,
                userId: payload.userId,
              };

              if (includePronunciation && wordPair.pronunciation) {
                wordData.pronunciation = wordPair.pronunciation.trim();
              }

              if (wordPair.imageUrl) {
                wordData.imageUrl = wordPair.imageUrl;
              }

              if (wordPair.audioUrl) {
                wordData.audioUrl = wordPair.audioUrl;
              }

              return wordData;
            }),
          },
        },
        include: {
          words: true,
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

    return NextResponse.json(
      {
        flashcardSet: result,
        message: `Successfully generated ${words.length} flashcards!`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
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
