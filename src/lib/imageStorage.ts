import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import sharp from "sharp";

/**
 * Word-image storage pipeline: AI generators hand over a base64 data URL
 * (typically a ~2 MB 1024px PNG). We shrink it to what the flashcard UI can
 * actually show, convert to WebP and upload to Vercel Blob, so the database
 * keeps only a short public URL in the existing `dataUrl` column.
 *
 * Every step degrades gracefully — worst case the original data URL is
 * stored, exactly as before this pipeline existed. Card creation must never
 * fail because of image post-processing.
 */

const TARGET_SIZE = 512;
const WEBP_QUALITY = 78;

export interface StoredWordImage {
  dataUrl: string;
  mimeType: string;
}

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function parseDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:[^;,]+;base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

async function compressToWebp(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

async function uploadToBlob(webp: Buffer): Promise<string | null> {
  if (!hasBlobToken()) return null;
  try {
    const blob = await put(`word-images/${randomUUID()}.webp`, webp, {
      access: "public",
      contentType: "image/webp",
      cacheControlMaxAge: 31_536_000,
    });
    return blob.url;
  } catch (error) {
    console.error("word image blob upload failed:", error);
    return null;
  }
}

/**
 * Compress + upload a freshly generated image. Accepts a base64 data URL
 * (or an http(s) URL, which is passed through untouched when copying an
 * already migrated image). Call OUTSIDE database transactions — it talks
 * to the network.
 */
export async function storeWordImage(
  sourceDataUrl: string,
  sourceMimeType = "image/png",
): Promise<StoredWordImage> {
  if (/^https?:\/\//.test(sourceDataUrl)) {
    return { dataUrl: sourceDataUrl, mimeType: sourceMimeType };
  }

  const original = parseDataUrl(sourceDataUrl);
  if (!original) return { dataUrl: sourceDataUrl, mimeType: sourceMimeType };

  const webp = await compressToWebp(original);
  if (!webp) return { dataUrl: sourceDataUrl, mimeType: sourceMimeType };

  const url = await uploadToBlob(webp);
  if (url) return { dataUrl: url, mimeType: "image/webp" };

  // No Blob token (or upload failed): keep at least the compression win.
  return {
    dataUrl: `data:image/webp;base64,${webp.toString("base64")}`,
    mimeType: "image/webp",
  };
}

/** Audio is already compressed (mp3) — it only moves to Blob as-is. */
export async function storeWordAudio(
  sourceDataUrl: string,
  sourceMimeType = "audio/mpeg",
): Promise<StoredWordImage> {
  if (/^https?:\/\//.test(sourceDataUrl)) {
    return { dataUrl: sourceDataUrl, mimeType: sourceMimeType };
  }
  const buffer = parseDataUrl(sourceDataUrl);
  if (!buffer) return { dataUrl: sourceDataUrl, mimeType: sourceMimeType };
  if (!hasBlobToken()) return { dataUrl: sourceDataUrl, mimeType: sourceMimeType };
  try {
    const blob = await put(`word-audio/${randomUUID()}.mp3`, buffer, {
      access: "public",
      contentType: sourceMimeType,
      cacheControlMaxAge: 31_536_000,
    });
    return { dataUrl: blob.url, mimeType: sourceMimeType };
  } catch (error) {
    console.error("word audio blob upload failed:", error);
    return { dataUrl: sourceDataUrl, mimeType: sourceMimeType };
  }
}
