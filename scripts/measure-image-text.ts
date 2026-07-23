/**
 * ROADMAP 3.4 measurement: how often generated flashcard images contain
 * residual text, old prompt vs. the new scene-based pipeline.
 *
 * Usage:
 *   npx tsx scripts/measure-image-text.ts            # 8 words x 2 variants
 *   SAMPLE_WORDS=4 npx tsx scripts/measure-image-text.ts
 *
 * Costs real money (image generations against OPENAI_API_KEY from .env).
 * No database writes, no coin accounting — pure API measurement.
 */

import { config } from "dotenv";
import OpenAI from "openai";
import {
  buildIllustrationPrompt,
  describeImageScene,
  detectTextInImage,
  generateFlashcardImage,
} from "../src/lib/openaiImage";
import { OPENAI_IMAGE_MODEL } from "../src/lib/openaiModels";

config();

// Mix of concrete, abstract and deliberately text-prone concepts.
const WORDS: { translation: string; language: string }[] = [
  { translation: "house", language: "English" },
  { translation: "dog", language: "English" },
  { translation: "newspaper", language: "English" },
  { translation: "menu", language: "English" },
  { translation: "school", language: "English" },
  { translation: "airport", language: "English" },
  { translation: "happiness", language: "English" },
  { translation: "running", language: "English" },
];

function oldPrompt(translation: string, language: string) {
  return `A simple, clear illustration representing the word "${translation}" in ${language}. The image should be educational and suitable for language learning flashcards. CRITICAL: The image must contain absolutely NO text, NO letters, NO words, NO characters, NO symbols that could be read as text, NO written language, NO numbers, and NO typography whatsoever. The image must be purely visual - only illustrations, drawings, or photographs without any written elements.`;
}

interface Row {
  word: string;
  variant: "old" | "new";
  textDetected: boolean | null;
  scene?: string;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY missing — aborting, nothing was charged.");
    process.exit(1);
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sampleSize = Math.min(
    WORDS.length,
    Math.max(1, Number.parseInt(process.env.SAMPLE_WORDS ?? "8", 10) || 8),
  );
  const words = WORDS.slice(0, sampleSize);
  const rows: Row[] = [];

  console.log(
    `Measuring ${words.length} words x 2 variants on ${OPENAI_IMAGE_MODEL}...`,
  );

  for (const { translation, language } of words) {
    // Old pipeline: quoted word + negation paragraph
    try {
      const url = await generateFlashcardImage(
        client,
        OPENAI_IMAGE_MODEL,
        oldPrompt(translation, language),
      );
      const detected = url ? await detectTextInImage(client, url) : null;
      rows.push({ word: translation, variant: "old", textDetected: detected });
      console.log(`old  ${translation.padEnd(12)} text=${String(detected)}`);
    } catch (error) {
      console.error(`old  ${translation}: generation failed`, error);
      rows.push({ word: translation, variant: "old", textDetected: null });
    }

    // New pipeline: scene description + icon style (no retry, raw rate)
    try {
      const scene = await describeImageScene(client, translation, language);
      const url = await generateFlashcardImage(
        client,
        OPENAI_IMAGE_MODEL,
        buildIllustrationPrompt(scene),
      );
      const detected = url ? await detectTextInImage(client, url) : null;
      rows.push({
        word: translation,
        variant: "new",
        textDetected: detected,
        scene,
      });
      console.log(
        `new  ${translation.padEnd(12)} text=${String(detected)}  scene="${scene}"`,
      );
    } catch (error) {
      console.error(`new  ${translation}: generation failed`, error);
      rows.push({ word: translation, variant: "new", textDetected: null });
    }
  }

  const summarize = (variant: Row["variant"]) => {
    const subset = rows.filter(
      (row) => row.variant === variant && row.textDetected !== null,
    );
    const detected = subset.filter((row) => row.textDetected === true).length;
    return { measured: subset.length, detected };
  };

  const oldStats = summarize("old");
  const newStats = summarize("new");
  console.log("\n=== RESULTS ===");
  console.log(
    `old prompt : ${oldStats.detected}/${oldStats.measured} images with text`,
  );
  console.log(
    `new pipeline: ${newStats.detected}/${newStats.measured} images with text`,
  );
  console.log(JSON.stringify(rows, null, 2));
}

void main();
