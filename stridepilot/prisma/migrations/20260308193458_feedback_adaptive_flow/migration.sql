-- CreateTable
CREATE TABLE "public"."WorkoutFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL,
    "effort" INTEGER NOT NULL,
    "completionPct" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "pain" BOOLEAN NOT NULL,
    "notes" TEXT,
    "adaptationFactor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WorkoutFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutFeedback_profileId_idx" ON "public"."WorkoutFeedback"("profileId");

-- CreateIndex
CREATE INDEX "WorkoutFeedback_workoutSessionId_idx" ON "public"."WorkoutFeedback"("workoutSessionId");

-- AddForeignKey
ALTER TABLE "public"."WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."RunnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "public"."WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
