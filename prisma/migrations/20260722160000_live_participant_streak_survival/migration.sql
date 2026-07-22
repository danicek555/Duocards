ALTER TABLE "live_participants" ADD COLUMN "streak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "live_participants" ADD COLUMN "bestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "live_participants" ADD COLUMN "eliminated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "live_participants" ADD COLUMN "practiceCorrect" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "live_participants" ADD COLUMN "practiceTotal" INTEGER NOT NULL DEFAULT 0;
