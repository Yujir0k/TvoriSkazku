-- Add category column to user_files
ALTER TABLE "user_files" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'other';

