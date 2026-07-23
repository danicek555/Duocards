import { prisma } from "@/lib/prisma";
import { adminJson, requireAdminApi } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const SHARED_BACKEND_URL =
  process.env.SHARED_BACKEND_URL?.trim().replace(/\/+$/, "") ||
  "https://duocards-backend-731652720086.europe-west1.run.app";

interface TableSize {
  table: string;
  bytes: bigint;
}

interface MediaAggregate {
  count: bigint;
  bytes: bigint | null;
}

async function checkBackendHealth(): Promise<{ ok: boolean; latencyMs: number | null }> {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    const response = await fetch(`${SHARED_BACKEND_URL}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: response.ok, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

// GET /api/admin/system — provozní metriky: velikosti tabulek, média v DB,
// stav Cloud Run backendu, poslední admin akce.
export async function GET() {
  const guard = await requireAdminApi("system.overview");
  if ("response" in guard) return guard.response;

  const [tableSizes, images, audio, backend, auditTrail] = await Promise.all([
    prisma.$queryRaw<TableSize[]>`
      SELECT c.relname AS table, pg_total_relation_size(c.oid) AS bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 12
    `,
    prisma.$queryRaw<MediaAggregate[]>`
      SELECT count(*)::bigint AS count, COALESCE(sum(length("dataUrl")), 0)::bigint AS bytes
      FROM "word_images"
    `,
    prisma.$queryRaw<MediaAggregate[]>`
      SELECT count(*)::bigint AS count, COALESCE(sum(length("dataUrl")), 0)::bigint AS bytes
      FROM "word_audio"
    `,
    checkBackendHealth(),
    prisma.$queryRaw<
      { adminUserId: number; action: string; detail: string | null; createdAt: Date }[]
    >`
      SELECT "adminUserId", "action", "detail", "createdAt"
      FROM "admin_audit_log"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `,
  ]);

  return adminJson({
    database: {
      tables: tableSizes.map((row) => ({
        table: row.table,
        bytes: Number(row.bytes),
      })),
      media: {
        images: {
          count: Number(images[0]?.count ?? 0),
          bytes: Number(images[0]?.bytes ?? 0),
        },
        audio: {
          count: Number(audio[0]?.count ?? 0),
          bytes: Number(audio[0]?.bytes ?? 0),
        },
      },
    },
    backend: {
      url: SHARED_BACKEND_URL,
      healthy: backend.ok,
      latencyMs: backend.latencyMs,
    },
    auditTrail,
  });
}
