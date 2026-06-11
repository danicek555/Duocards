import type OpenAI from "openai";

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
