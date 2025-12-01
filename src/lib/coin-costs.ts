// Coin costs based on real API costs
export const COIN_COSTS = {
  // Text generation (flashcard generation)
  FLASHCARD_GENERATION: 5, // Base cost for generating flashcards

  // Image generation (expensive - DALL-E 3 costs ~$0.04 per image)
  IMAGE_GENERATION: 80, // Expensive - reflects real cost

  // Audio generation (TTS)
  AUDIO_GENERATION: 5, // Moderate cost

  // Pronunciation generation (cheap - just text)
  PRONUNCIATION_GENERATION: 1, // Very cheap

  // Word translation (cheap - minimal tokens)
  WORD_TRANSLATION: 1, // Very cheap

  // OCR (text extraction from image - uses vision API)
  OCR_EXTRACTION: 50, // Expensive - vision API is more expensive

  // AI Chat (conversational AI assistance)
  AI_CHAT: 3, // Low cost for chat messages
} as const;
