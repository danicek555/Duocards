import { prisma } from "./prisma";

/**
 * Generates a unique public code in format XXXX-XXXX
 * @returns A unique 8-digit code formatted as XXXX-XXXX
 */
export async function generatePublicCode(): Promise<string> {
  let code: string = "";
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    // Generate 8 random digits
    const digits = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 10)
    ).join("");

    // Format as XXXX-XXXX
    code = `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;

    // Check if code already exists
    // Since publicCode is unique, we can use findUnique
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma.flashcardSet.findUnique as any)({
      where: { publicCode: code },
      select: { id: true },
    });

    if (!existing) {
      isUnique = true;
    }

    attempts++;
  }

  if (!isUnique || !code) {
    throw new Error(
      "Failed to generate unique public code after multiple attempts"
    );
  }

  return code;
}
