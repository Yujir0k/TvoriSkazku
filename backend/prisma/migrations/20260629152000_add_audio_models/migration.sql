-- Create story_audio table
CREATE TABLE IF NOT EXISTS "story_audio" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL DEFAULT 'system',
    "provider" TEXT NOT NULL DEFAULT 'system',
    "status" TEXT NOT NULL DEFAULT 'creating',
    "objectName" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_audio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "story_audio_storyId_idx" ON "story_audio"("storyId");
CREATE INDEX IF NOT EXISTS "story_audio_userId_idx" ON "story_audio"("userId");
ALTER TABLE "story_audio" ADD CONSTRAINT "story_audio_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_audio" ADD CONSTRAINT "story_audio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create listening_progress table
CREATE TABLE IF NOT EXISTS "listening_progress" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "storyAudioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "listening_progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "listening_progress_userId_storyAudioId_key" ON "listening_progress"("userId", "storyAudioId");
CREATE INDEX IF NOT EXISTS "listening_progress_userId_idx" ON "listening_progress"("userId");
ALTER TABLE "listening_progress" ADD CONSTRAINT "listening_progress_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listening_progress" ADD CONSTRAINT "listening_progress_storyAudioId_fkey" FOREIGN KEY ("storyAudioId") REFERENCES "story_audio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listening_progress" ADD CONSTRAINT "listening_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create voice_consents table
CREATE TABLE IF NOT EXISTS "voice_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL DEFAULT '1.0',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voice_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "voice_consents_userId_idx" ON "voice_consents"("userId");
ALTER TABLE "voice_consents" ADD CONSTRAINT "voice_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create voice_samples table
CREATE TABLE IF NOT EXISTS "voice_samples" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voice_samples_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "voice_samples_objectName_key" UNIQUE ("objectName")
);
CREATE INDEX IF NOT EXISTS "voice_samples_userId_idx" ON "voice_samples"("userId");
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "voice_consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
