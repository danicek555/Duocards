import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? "";
if (
  process.env.NODE_ENV !== "test" ||
  (!databaseUrl.includes("127.0.0.1") && !databaseUrl.includes("localhost"))
) {
  throw new Error(
    "Coin migration tests require NODE_ENV=test and a local disposable database",
  );
}

const schemaName = `coin_migration_${randomUUID().replaceAll("-", "")}`;
const client = new Client({ connectionString: databaseUrl });
let connected = false;

try {
  await client.connect();
  connected = true;
  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}"`);
  await client.query(`
    CREATE TABLE "users" (
      "id" SERIAL PRIMARY KEY,
      "coins" INTEGER NOT NULL DEFAULT 100
    );
    CREATE TABLE "completion_rewards" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "amount" INTEGER NOT NULL,
      "flashcardSetId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX "completion_rewards_userId_createdAt_idx"
      ON "completion_rewards"("userId", "createdAt");
    INSERT INTO "users" ("coins") VALUES (-5), (100);
  `);

  const migration = await readFile(
    resolve(
      "prisma/migrations/20260721120000_secure_coin_economy/migration.sql",
    ),
    "utf8",
  );
  await client.query(migration);

  const users = await client.query<{ id: number; coins: number }>(
    `SELECT "id", "coins" FROM "users" ORDER BY "id"`,
  );
  assert.deepEqual(users.rows, [
    { id: 1, coins: 0 },
    { id: 2, coins: 100 },
  ]);

  const openingRows = await client.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM "coin_transactions"
     WHERE "type" = 'OPENING_BALANCE'`,
  );
  assert.equal(openingRows.rows[0]?.count, 2);

  await assert.rejects(
    client.query(`UPDATE "users" SET "coins" = -1 WHERE "id" = 2`),
  );

  await client.query(`
    INSERT INTO "completion_rewards"
      ("userId", "amount", "flashcardSetId", "claimDate")
    VALUES (2, 10, 7, DATE '2026-07-21')
  `);
  await assert.rejects(
    client.query(`
      INSERT INTO "completion_rewards"
        ("userId", "amount", "flashcardSetId", "claimDate")
      VALUES (2, 10, 7, DATE '2026-07-21')
    `),
  );

  console.log("Coin economy migration constraints verified");
} finally {
  if (connected) {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await client.end();
  }
}
