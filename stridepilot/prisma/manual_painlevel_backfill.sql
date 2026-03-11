ALTER TABLE "WorkoutFeedback" ADD COLUMN IF NOT EXISTS "painLevel" INTEGER;
UPDATE "WorkoutFeedback" SET "painLevel" = 1 WHERE "painLevel" IS NULL;
ALTER TABLE "WorkoutFeedback" ALTER COLUMN "painLevel" SET NOT NULL;
