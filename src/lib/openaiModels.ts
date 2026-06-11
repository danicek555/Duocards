/** Shared OpenAI model IDs — keep in sync with scripts/check-ai-health.ts */

export const OPENAI_CHAT_MODEL =
  process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

export const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";

export const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";

export const OPENAI_TTS_VOICE = "alloy" as const;

export function chatCompletionSupportsTemperature(model: string): boolean {
  return !model.includes("gpt-5-nano") && !model.includes("gpt-5");
}
