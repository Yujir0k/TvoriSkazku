-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voiceId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "story_audio" ADD COLUMN     "jobId" TEXT;
