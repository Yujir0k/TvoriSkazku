ALTER TABLE "story_illustrations"
ADD COLUMN "provider" TEXT,
ADD COLUMN "providerJobId" TEXT;

CREATE INDEX "story_illustrations_providerJobId_idx"
ON "story_illustrations"("providerJobId");
