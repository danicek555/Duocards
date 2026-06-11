/**
 * Smoke-test every OpenAI capability DuoCards uses.
 * Run manually or via the monthly GitHub Actions workflow.
 *
 * Usage:
 *   npm run check-ai-health
 *   SKIP_AI_IMAGE_CHECK=1 npm run check-ai-health   # skip paid image generation
 *
 * Loads .env from the project root (Next.js does this automatically; standalone scripts do not).
 * On image model failure, probes the OpenAI API for a working model and updates .env locally.
 */

import { config } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";
import {
  probeImageGeneration,
  resolveWorkingImageModel,
} from "../src/lib/openaiImage";
import {
  OPENAI_CHAT_MODEL,
  OPENAI_IMAGE_MODEL,
  OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE,
  chatCompletionSupportsTemperature,
} from "../src/lib/openaiModels";

const projectRoot = process.cwd();
config({ path: resolve(projectRoot, ".env") });
if (existsSync(resolve(projectRoot, ".env.local"))) {
  config({ path: resolve(projectRoot, ".env.local"), override: true });
}
if (existsSync(resolve(projectRoot, ".env.development.local"))) {
  config({
    path: resolve(projectRoot, ".env.development.local"),
    override: true,
  });
}

type CheckResult = {
  feature: string;
  model: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
  error?: string;
};

const skipImageCheck =
  process.env.SKIP_AI_IMAGE_CHECK === "1" ||
  process.env.SKIP_AI_IMAGE_CHECK === "true";

/** 1×1 PNG — enough to verify vision / image input on chat completions */
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function persistImageModelToEnv(modelId: string): boolean {
  const envPath = resolve(projectRoot, ".env");
  if (!existsSync(envPath)) {
    console.warn("Could not update .env (file missing).");
    return false;
  }

  const line = `OPENAI_IMAGE_MODEL=${modelId}`;
  let content = readFileSync(envPath, "utf8");

  if (/^OPENAI_IMAGE_MODEL=/m.test(content)) {
    content = content.replace(/^OPENAI_IMAGE_MODEL=.*$/m, line);
  } else if (/^# OPENAI_IMAGE_MODEL=/m.test(content)) {
    content = content.replace(/^# OPENAI_IMAGE_MODEL=.*$/m, line);
  } else {
    content = `${content.trimEnd()}\n${line}\n`;
  }

  writeFileSync(envPath, content);
  process.env.OPENAI_IMAGE_MODEL = modelId;
  return true;
}

async function runCheck(
  feature: string,
  model: string,
  fn: () => Promise<string>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return {
      feature,
      model,
      ok: true,
      durationMs: Date.now() - start,
      detail,
    };
  } catch (error) {
    return {
      feature,
      model,
      ok: false,
      durationMs: Date.now() - start,
      error: formatError(error),
    };
  }
}

async function checkChatCompletions(client: OpenAI): Promise<CheckResult> {
  return runCheck("chat-completions", OPENAI_CHAT_MODEL, async () => {
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [{ role: "user", content: 'Reply with exactly: {"ok":true}' }],
      max_tokens: 16,
      ...(chatCompletionSupportsTemperature(OPENAI_CHAT_MODEL)
        ? { temperature: 0 }
        : {}),
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty chat completion response");
    return text.slice(0, 80);
  });
}

async function checkJsonFlashcardGeneration(
  client: OpenAI
): Promise<CheckResult> {
  return runCheck("flashcard-json-generation", OPENAI_CHAT_MODEL, async () => {
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "Return valid JSON with a flashcards array. No markdown.",
        },
        {
          role: "user",
          content:
            'Return {"flashcards":[{"word":"hello","translation":"ahoj"}]}',
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 64,
      ...(chatCompletionSupportsTemperature(OPENAI_CHAT_MODEL)
        ? { temperature: 0 }
        : {}),
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Empty JSON completion response");
    const parsed = JSON.parse(text) as { flashcards?: unknown };
    if (!Array.isArray(parsed.flashcards)) {
      throw new Error("Response missing flashcards array");
    }
    return `${parsed.flashcards.length} flashcard(s) in JSON`;
  });
}

async function checkVisionOcr(client: OpenAI): Promise<CheckResult> {
  return runCheck("vision-image-input", OPENAI_CHAT_MODEL, async () => {
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'What color is this image? Reply with one word: "red".',
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${TINY_PNG_BASE64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 8,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty vision completion response");
    return text.slice(0, 40);
  });
}

async function checkImageGeneration(client: OpenAI): Promise<CheckResult> {
  const configuredModel = OPENAI_IMAGE_MODEL;
  const start = Date.now();

  const firstTry = await probeImageGeneration(client, configuredModel);
  if (firstTry.ok) {
    return {
      feature: "image-generation",
      model: configuredModel,
      ok: true,
      durationMs: Date.now() - start,
      detail: firstTry.detail,
    };
  }

  console.warn(
    `Configured image model "${configuredModel}" failed: ${firstTry.error}`
  );
  console.warn("Searching OpenAI for a working image generation model...");

  const resolved = await resolveWorkingImageModel(client, configuredModel);
  if (!resolved) {
    return {
      feature: "image-generation",
      model: configuredModel,
      ok: false,
      durationMs: Date.now() - start,
      error: firstTry.error,
    };
  }

  if (resolved.model !== configuredModel) {
    const updated = persistImageModelToEnv(resolved.model);
    if (updated) {
      console.log(`Updated .env → OPENAI_IMAGE_MODEL=${resolved.model}`);
    } else {
      console.warn(
        `Add to .env manually: OPENAI_IMAGE_MODEL=${resolved.model}`
      );
    }
  }

  return {
    feature: "image-generation",
    model: resolved.model,
    ok: true,
    durationMs: Date.now() - start,
    detail:
      resolved.model === configuredModel
        ? resolved.detail
        : `${resolved.detail} (switched from ${configuredModel})`,
  };
}

async function checkTextToSpeech(client: OpenAI): Promise<CheckResult> {
  return runCheck("text-to-speech", OPENAI_TTS_MODEL, async () => {
    const response = await client.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: "test",
    });
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) throw new Error("TTS returned empty audio");
    return `${buffer.byteLength} bytes audio`;
  });
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  console.log("DuoCards AI health check");
  console.log(`Chat model:  ${OPENAI_CHAT_MODEL}`);
  console.log(
    `Image model: ${OPENAI_IMAGE_MODEL}${skipImageCheck ? " (skipped)" : ""}`
  );
  console.log(`TTS model:   ${OPENAI_TTS_MODEL}`);
  console.log("");

  const checks: CheckResult[] = [
    await checkChatCompletions(client),
    await checkJsonFlashcardGeneration(client),
    await checkVisionOcr(client),
    await checkTextToSpeech(client),
  ];

  if (!skipImageCheck) {
    checks.push(await checkImageGeneration(client));
  }

  let failed = 0;
  for (const result of checks) {
    const status = result.ok ? "OK" : "FAIL";
    const line = `[${status}] ${result.feature} (${result.model}) — ${result.durationMs}ms`;
    if (result.ok) {
      console.log(`${line}${result.detail ? ` — ${result.detail}` : ""}`);
    } else {
      failed += 1;
      console.error(`${line}`);
      console.error(`       ${result.error}`);
    }
  }

  console.log("");
  if (failed > 0) {
    console.error(
      `${failed} check(s) failed. Set OPENAI_IMAGE_MODEL in .env or src/lib/openaiModels.ts.`
    );
    process.exit(1);
  }

  console.log("All AI checks passed.");
}

main().catch((error) => {
  console.error("AI health check crashed:", error);
  process.exit(1);
});
