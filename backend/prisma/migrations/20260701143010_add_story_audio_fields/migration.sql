-- AlterTable
ALTER TABLE "story_audio" ADD COLUMN     "characterVoices" TEXT,
ADD COLUMN     "expressive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'single',
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;
