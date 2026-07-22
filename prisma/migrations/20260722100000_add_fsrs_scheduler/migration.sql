-- FSRS scheduler state on words
ALTER TABLE "words"
ADD COLUMN "reviewStability" DOUBLE PRECISION,
ADD COLUMN "reviewDifficulty" DOUBLE PRECISION;

-- Rich per-review telemetry so a custom algorithm can be trained and
-- benchmarked against this log later.
ALTER TABLE "study_reviews"
ADD COLUMN "scheduler" VARCHAR(16) NOT NULL DEFAULT 'sm2-lite',
ADD COLUMN "fsrsRating" VARCHAR(8),
ADD COLUMN "responseMs" INTEGER,
ADD COLUMN "elapsedDays" DOUBLE PRECISION,
ADD COLUMN "retrievability" DOUBLE PRECISION,
ADD COLUMN "stabilityBefore" DOUBLE PRECISION,
ADD COLUMN "stabilityAfter" DOUBLE PRECISION,
ADD COLUMN "difficultyBefore" DOUBLE PRECISION,
ADD COLUMN "difficultyAfter" DOUBLE PRECISION,
ADD COLUMN "desiredRetention" DOUBLE PRECISION;
