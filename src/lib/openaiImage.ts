import type OpenAI from "openai";
import { OPENAI_CHAT_MODEL } from "./openaiModels";

/**
 * Layer 1 of the "no residual text in images" fix (ROADMAP 3.4): the image
 * prompt never quotes the word itself and uses an icon-like style that
 * naturally avoids signage. Negative "NO text" shouting is gone on purpose —
 * diffusion models handle negation poorly and it made things worse.
 *
 * Layer 2 is an optional post-generation text check with bounded retries,
 * controlled by env:
 *   IMAGE_TEXT_CHECK=off              disable the vision check entirely
 *   IMAGE_TEXT_CHECK_MAX_RETRIES=0..3 extra generations after a detection
 */

export function parseImageTextCheckEnv(
  env: Record<string, string | undefined>,
) {
  const enabled = (env.IMAGE_TEXT_CHECK ?? "on").trim().toLowerCase() !== "off";
  const parsed = Number.parseInt(env.IMAGE_TEXT_CHECK_MAX_RETRIES ?? "1", 10);
  const maxRetries = Number.isFinite(parsed)
    ? Math.min(3, Math.max(0, parsed))
    : 1;
  return { enabled, maxRetries };
}

const TEXT_CHECK = parseImageTextCheckEnv(process.env);

/** Icon-style illustration prompt built from a visual scene description. */
export function buildIllustrationPrompt(scene: string): string {
  const cleaned = scene.trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  return `Flat vector illustration for a language-learning flashcard: ${cleaned}. Minimalist style, soft colors, one clear subject on a plain background. The image is purely pictorial.`;
}

/**
 * Ask the chat model for a short visual scene depicting the concept, so the
 * image prompt never contains the quoted word. Falls back to the raw
 * translation when the call fails.
 */
export async function describeImageScene(
  client: OpenAI,
  translation: string,
  language: string,
): Promise<string> {
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: "user",
          content: `In 8-15 English words, describe a simple visual scene that unmistakably depicts the concept of "${translation}" (${language}). Mention only objects, creatures or actions. Never mention letters, words, signs, labels, books or writing. Reply with the scene only.`,
        },
      ],
    });
    const scene = completion.choices[0]?.message?.content?.trim();
    return scene && scene.length >= 3 ? scene : translation;
  } catch {
    return translation;
  }
}

/**
 * Layer 2: does the generated image contain readable text? Returns null when
 * detection itself fails — a broken checker must never block generation.
 */
export async function detectTextInImage(
  client: OpenAI,
  imageUrl: string,
): Promise<boolean | null> {
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Does this image contain any readable text, letters, numbers or typography (including partial or garbled lettering)? Answer with exactly YES or NO.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
          ],
        },
      ],
    });
    const answer = completion.choices[0]?.message?.content
      ?.trim()
      .toUpperCase();
    if (!answer) return null;
    if (answer.startsWith("YES")) return true;
    if (answer.startsWith("NO")) return false;
    return null;
  } catch {
    return null;
  }
}

export interface CheckedImageResult {
  imageUrl: string | null;
  textDetected: boolean | null;
  generations: number;
}

/**
 * Generate a flashcard illustration from a scene description; when the text
 * check is enabled, verify the result and regenerate a bounded number of
 * times. The last image is always returned, even if still flagged.
 */
export async function generateCheckedFlashcardImage(
  client: OpenAI,
  model: string,
  scene: string,
): Promise<CheckedImageResult> {
  const prompt = buildIllustrationPrompt(scene);
  let imageUrl = await generateFlashcardImage(client, model, prompt);
  let generations = 1;
  let textDetected: boolean | null = null;

  if (imageUrl && TEXT_CHECK.enabled) {
    textDetected = await detectTextInImage(client, imageUrl);
    while (textDetected === true && generations <= TEXT_CHECK.maxRetries) {
      const retryUrl = await generateFlashcardImage(client, model, prompt);
      generations += 1;
      if (!retryUrl) break;
      imageUrl = retryUrl;
      textDetected = await detectTextInImage(client, imageUrl);
    }
  }

  console.log(
    JSON.stringify({
      event: "image_text_check",
      enabled: TEXT_CHECK.enabled,
      textDetected,
      generations,
      model,
    }),
  );
  return { imageUrl, textDetected, generations };
}

/** Prefer newest first; API list is merged with this order. */
export const KNOWN_IMAGE_MODELS_PREFERENCE = [
  "gpt-image-2",
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
  "chatgpt-image-latest",
  "dall-e-3",
  "dall-e-2",
] as const;

export function isLikelyImageGenerationModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return (
    id.includes("gpt-image") ||
    id.startsWith("dall-e") ||
    id === "chatgpt-image-latest"
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isImageModelUnavailableError(error: unknown): boolean {
  const msg = formatError(error).toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("model_not_found") ||
    msg.includes("deprecated") ||
    msg.includes("no longer available")
  );
}

export async function listImageModelCandidates(
  client: OpenAI
): Promise<string[]> {
  const fromApi: string[] = [];
  try {
    for await (const model of client.models.list()) {
      if (isLikelyImageGenerationModel(model.id)) {
        fromApi.push(model.id);
      }
    }
  } catch {
    // Some keys cannot list models — fall back to known IDs only.
  }

  const ordered = new Set<string>();
  for (const id of KNOWN_IMAGE_MODELS_PREFERENCE) ordered.add(id);
  for (const id of fromApi.sort()) ordered.add(id);
  return [...ordered];
}

function imageGenerateOptions(model: string, prompt: string) {
  return {
    model,
    prompt,
    n: 1,
    size: "1024x1024" as const,
  };
}

export async function probeImageGeneration(
  client: OpenAI,
  model: string
): Promise<{ ok: true; detail: string } | { ok: false; error: string }> {
  try {
    const response = await client.images.generate(
      imageGenerateOptions(
        model,
        "A simple red circle on a white background. No text or letters."
      )
    );
    const data = response.data?.[0];
    if (data?.url) return { ok: true, detail: "received image URL" };
    if (data?.b64_json) return { ok: true, detail: "received base64 image" };
    return { ok: false, error: "Image API returned no url or b64_json" };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
}

/** Try preferred model first, then API / known candidates until one works. */
export async function resolveWorkingImageModel(
  client: OpenAI,
  preferred?: string
): Promise<{ model: string; detail: string } | null> {
  const candidates = await listImageModelCandidates(client);
  const tryOrder = preferred
    ? [preferred, ...candidates.filter((c) => c !== preferred)]
    : candidates;

  for (const model of tryOrder) {
    const result = await probeImageGeneration(client, model);
    if (result.ok) {
      return { model, detail: result.detail };
    }
  }
  return null;
}

/** Turn images.generate response into a storable URL or data URL. */
export async function imageUrlFromGenerationResponse(
  response: OpenAI.Images.ImagesResponse,
  mimeType = "image/png"
): Promise<string | null> {
  const item = response.data?.[0];
  if (!item) return null;

  if (item.b64_json) {
    return `data:${mimeType};base64,${item.b64_json}`;
  }

  const tempUrl = item.url;
  if (!tempUrl) return null;

  try {
    const imageFetch = await fetch(tempUrl);
    const imageBuffer = await imageFetch.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const fetchedMime =
      imageFetch.headers.get("content-type") || mimeType;
    return `data:${fetchedMime};base64,${imageBase64}`;
  } catch {
    return tempUrl;
  }
}

export async function generateFlashcardImage(
  client: OpenAI,
  model: string,
  prompt: string
): Promise<string | null> {
  try {
    const response = await client.images.generate(
      imageGenerateOptions(model, prompt)
    );
    return imageUrlFromGenerationResponse(response);
  } catch (error) {
    if (!isImageModelUnavailableError(error)) {
      throw error;
    }
    const resolved = await resolveWorkingImageModel(client, model);
    if (!resolved) throw error;
    const retry = await client.images.generate(
      imageGenerateOptions(resolved.model, prompt)
    );
    return imageUrlFromGenerationResponse(retry);
  }
}
