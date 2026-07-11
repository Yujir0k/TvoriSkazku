-- Add personalizationNames and ttsPrivacyStatus fields to stories table
ALTER TABLE "stories" ADD COLUMN "personalization_names" TEXT;
ALTER TABLE "stories" ADD COLUMN "tts_privacy_status" TEXT DEFAULT NULL;
