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
    "Study migration tests require NODE_ENV=test and a local disposable database",
  );
}

const schemaName = `study_migration_${randomUUID().replaceAll("-", "")}`;
const client = new Client({ connectionString: databaseUrl });
let connected = false;

try {
  await client.connect();
  connected = true;
  await client.query(`CREATE SCHEMA "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}"`);
  await client.query(`
    CREATE TABLE "users" (
      "id" SERIAL PRIMARY KEY
    );
    CREATE TABLE "flashcard_sets" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
    );
    CREATE TABLE "words" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "flashcardSetId" INTEGER REFERENCES "flashcard_sets"("id") ON DELETE CASCADE
    );
    CREATE TABLE "completion_rewards" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "amount" INTEGER NOT NULL,
      "flashcardSetId" INTEGER NOT NULL,
      "claimDate" DATE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO "users" DEFAULT VALUES;
    INSERT INTO "flashcard_sets" ("userId") VALUES (1);
    INSERT INTO "words" ("userId", "flashcardSetId") VALUES (1, 1);
  `);

  const migration = await readFile(
    resolve("prisma/migrations/20260721140000_add_study_srs_v1/migration.sql"),
    "utf8",
  );
  await client.query(migration);

  const word = await client.query<{
    reviewIntervalDays: number;
    reviewEase: number;
    reviewStreak: number;
  }>(
    `SELECT "reviewIntervalDays", "reviewEase", "reviewStreak"
     FROM "words" WHERE "id" = 1`,
  );
  assert.deepEqual(word.rows[0], {
    reviewIntervalDays: 0,
    reviewEase: 220,
    reviewStreak: 0,
  });

  const sessionId = randomUUID();
  await client.query(
    `INSERT INTO "study_sessions"
      ("id", "userId", "flashcardSetId", "wordIds", "totalWords", "isFullSet")
     VALUES ($1, 1, 1, ARRAY[1], 1, true)`,
    [sessionId],
  );
  await client.query(
    `INSERT INTO "study_reviews"
      ("id", "sessionId", "userId", "wordId", "flashcardSetId",
       "idempotencyKey", "rating", "intervalBeforeDays", "intervalAfterDays",
       "easeAfter", "nextReviewAt")
     VALUES ($1, $2, 1, 1, 1, 'same-answer', 'KNOW', 0, 1, 225, NOW())`,
    [randomUUID(), sessionId],
  );
  await assert.rejects(
    client.query(
      `INSERT INTO "study_reviews"
        ("id", "sessionId", "userId", "wordId", "flashcardSetId",
         "idempotencyKey", "rating", "intervalBeforeDays", "intervalAfterDays",
         "easeAfter", "nextReviewAt")
       VALUES ($1, $2, 1, 1, 1, 'same-answer', 'KNOW', 0, 1, 225, NOW())`,
      [randomUUID(), sessionId],
    ),
  );

  await client.query(
    `INSERT INTO "completion_rewards"
      ("userId", "amount", "flashcardSetId", "studySessionId")
     VALUES (1, 1, 1, $1)`,
    [sessionId],
  );
  await assert.rejects(
    client.query(
      `INSERT INTO "completion_rewards"
        ("userId", "amount", "flashcardSetId", "studySessionId")
       VALUES (1, 1, 1, $1)`,
      [sessionId],
    ),
  );

  console.log("Study SRS migration constraints verified");
} finally {
  if (connected) {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await client.end();
  }
}
