import { prisma } from "@/lib/prisma";
import { adminJson, requireAdminApi } from "@/lib/adminAuth";
import { storeWordAudio, storeWordImage } from "@/lib/imageStorage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMAGE_BATCH = 10;
const AUDIO_BATCH = 20;

interface MediaRow {
  id: number;
  dataUrl: string;
  mimeType: string;
}

// POST /api/admin/migrate-media — přesune jednu dávku base64 médií z DB do
// Vercel Blob (obrázky navíc zkomprimuje na WebP). Volá se opakovaně,
// dokud zbývá co migrovat; průběh řídí tlačítko na stránce Systém.
export async function POST() {
  const guard = await requireAdminApi("media.migrate");
  if ("response" in guard) return guard.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return adminJson(
      {
        error:
          "BLOB_READ_WRITE_TOKEN chybí — připojte Blob store k projektu ve Vercel dashboardu (Storage → Connect Project).",
      },
      409,
    );
  }

  const [images, audio] = await Promise.all([
    prisma.$queryRaw<MediaRow[]>`
      SELECT "id", "dataUrl", "mimeType" FROM "word_images"
      WHERE "dataUrl" LIKE 'data:%' ORDER BY "id" LIMIT ${IMAGE_BATCH}
    `,
    prisma.$queryRaw<MediaRow[]>`
      SELECT "id", "dataUrl", "mimeType" FROM "word_audio"
      WHERE "dataUrl" LIKE 'data:%' ORDER BY "id" LIMIT ${AUDIO_BATCH}
    `,
  ]);

  let migratedImages = 0;
  let migratedAudio = 0;
  let savedBytes = 0;

  for (const row of images) {
    const stored = await storeWordImage(row.dataUrl, row.mimeType);
    if (!/^https?:\/\//.test(stored.dataUrl)) continue; // upload selhal
    await prisma.$executeRaw`
      UPDATE "word_images" SET "dataUrl" = ${stored.dataUrl}, "mimeType" = ${stored.mimeType}
      WHERE "id" = ${row.id}
    `;
    migratedImages += 1;
    savedBytes += row.dataUrl.length - stored.dataUrl.length;
  }

  for (const row of audio) {
    const stored = await storeWordAudio(row.dataUrl, row.mimeType);
    if (!/^https?:\/\//.test(stored.dataUrl)) continue;
    await prisma.$executeRaw`
      UPDATE "word_audio" SET "dataUrl" = ${stored.dataUrl}, "mimeType" = ${stored.mimeType}
      WHERE "id" = ${row.id}
    `;
    migratedAudio += 1;
    savedBytes += row.dataUrl.length - stored.dataUrl.length;
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
    remainingImages: Number(remainingImages[0]?.count ?? 0),
    remainingAudio: Number(remainingAudio[0]?.count ?? 0),
  });
}
