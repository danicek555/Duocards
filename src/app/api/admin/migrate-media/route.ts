import { prisma } from "@/lib/prisma";
import { adminJson, requireAdminApi } from "@/lib/adminAuth";
import { storeWordAudio, storeWordImage } from "@/lib/imageStorage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Prisma Accelerate limituje velikost odpovědi (~5 MB) — base64 obrázky se
// proto tahají po JEDNOM řádku a dávku ukončuje časový rozpočet, ne počet.
const TIME_BUDGET_MS = 35_000;
const MAX_ITEMS_PER_CALL = 25;

interface MediaRow {
  id: number;
  dataUrl: string;
  mimeType: string;
}

async function nextRow(
  table: "word_images" | "word_audio",
  afterId: number,
): Promise<MediaRow | null> {
  const rows =
    table === "word_images"
      ? await prisma.$queryRaw<MediaRow[]>`
          SELECT "id", "dataUrl", "mimeType" FROM "word_images"
          WHERE "dataUrl" LIKE 'data:%' AND "id" > ${afterId}
          ORDER BY "id" LIMIT 1
        `
      : await prisma.$queryRaw<MediaRow[]>`
          SELECT "id", "dataUrl", "mimeType" FROM "word_audio"
          WHERE "dataUrl" LIKE 'data:%' AND "id" > ${afterId}
          ORDER BY "id" LIMIT 1
        `;
  return rows[0] ?? null;
}

async function updateRow(
  table: "word_images" | "word_audio",
  id: number,
  dataUrl: string,
  mimeType: string,
): Promise<void> {
  if (table === "word_images") {
    await prisma.$executeRaw`
      UPDATE "word_images" SET "dataUrl" = ${dataUrl}, "mimeType" = ${mimeType} WHERE "id" = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "word_audio" SET "dataUrl" = ${dataUrl}, "mimeType" = ${mimeType} WHERE "id" = ${id}
    `;
  }
}

// POST /api/admin/migrate-media — přesune dávku base64 médií do Vercel Blob.
// Body: { afterImageId?, afterAudioId? } — kurzory z předchozího volání;
// řádky, které se nepodaří zpracovat, se přeskočí a vrátí v `failed`.
export async function POST(request: Request) {
  const guard = await requireAdminApi("media.migrate");
  if ("response" in guard) return guard.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return adminJson(
      {
        error:
          "BLOB_READ_WRITE_TOKEN chybí — připojte Blob store k projektu ve Vercel dashboardu.",
      },
      409,
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    afterImageId?: number;
    afterAudioId?: number;
  };
  let imageCursor = Number.isInteger(body.afterImageId) ? body.afterImageId! : 0;
  let audioCursor = Number.isInteger(body.afterAudioId) ? body.afterAudioId! : 0;

  const startedAt = Date.now();
  const failed: { table: string; id: number; reason: string }[] = [];
  let migratedImages = 0;
  let migratedAudio = 0;
  let savedBytes = 0;
  let processed = 0;

  const timeLeft = () => TIME_BUDGET_MS - (Date.now() - startedAt);

  // Obrázky mají prioritu (jsou řádově větší), zbytek rozpočtu patří audiu.
  while (processed < MAX_ITEMS_PER_CALL && timeLeft() > 8_000) {
    let row: MediaRow | null = null;
    try {
      row = await nextRow("word_images", imageCursor);
    } catch (error) {
      // Typicky příliš velký řádek pro Accelerate — přeskočit posunem kurzoru.
      failed.push({
        table: "word_images",
        id: imageCursor + 1,
        reason: (error as Error).message.slice(0, 120),
      });
      imageCursor += 1;
      processed += 1;
      continue;
    }
    if (!row) break;
    imageCursor = row.id;
    processed += 1;
    try {
      const stored = await storeWordImage(row.dataUrl, row.mimeType);
      if (!/^https?:\/\//.test(stored.dataUrl)) {
        failed.push({ table: "word_images", id: row.id, reason: stored.error ?? "upload failed" });
        continue;
      }
      await updateRow("word_images", row.id, stored.dataUrl, stored.mimeType);
      migratedImages += 1;
      savedBytes += row.dataUrl.length - stored.dataUrl.length;
    } catch (error) {
      failed.push({
        table: "word_images",
        id: row.id,
        reason: (error as Error).message.slice(0, 120),
      });
    }
  }

  while (processed < MAX_ITEMS_PER_CALL && timeLeft() > 5_000) {
    let row: MediaRow | null = null;
    try {
      row = await nextRow("word_audio", audioCursor);
    } catch (error) {
      failed.push({
        table: "word_audio",
        id: audioCursor + 1,
        reason: (error as Error).message.slice(0, 120),
      });
      audioCursor += 1;
      processed += 1;
      continue;
    }
    if (!row) break;
    audioCursor = row.id;
    processed += 1;
    try {
      const stored = await storeWordAudio(row.dataUrl, row.mimeType);
      if (!/^https?:\/\//.test(stored.dataUrl)) {
        failed.push({ table: "word_audio", id: row.id, reason: stored.error ?? "upload failed" });
        continue;
      }
      await updateRow("word_audio", row.id, stored.dataUrl, stored.mimeType);
      migratedAudio += 1;
      savedBytes += row.dataUrl.length - stored.dataUrl.length;
    } catch (error) {
      failed.push({
        table: "word_audio",
        id: row.id,
        reason: (error as Error).message.slice(0, 120),
      });
    }
  }

  const [remainingImages, remainingAudio] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM "word_images" WHERE "dataUrl" LIKE 'data:%'
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM "word_audio" WHERE "dataUrl" LIKE 'data:%'
    `,
  ]);

  return adminJson({
    migratedImages,
    migratedAudio,
    savedBytes,
    failed,
    afterImageId: imageCursor,
    afterAudioId: audioCursor,
    remainingImages: Number(remainingImages[0]?.count ?? 0),
    remainingAudio: Number(remainingAudio[0]?.count ?? 0),
  });
}
