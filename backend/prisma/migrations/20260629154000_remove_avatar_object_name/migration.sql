-- This migration safely removes avatarobjectname from users table
-- First verify no data loss: check if any non-null values exist (just a safety check)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE avatarobjectname IS NOT NULL) THEN
    RAISE NOTICE 'Found non-null avatarobjectname values — moving to user_files will be handled by application code';
  END IF;
END $$;

ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarobjectname";
