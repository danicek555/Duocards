/**
 * Server-only adapter loader for Prisma 7
 * This file should never be imported in client components
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export function createPgAdapter(connectionString: string) {
  const pool = new Pool({ connectionString });
  return new PrismaPg(pool);
}
