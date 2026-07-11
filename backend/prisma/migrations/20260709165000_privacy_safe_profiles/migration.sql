ALTER TABLE "child_profiles"
ADD COLUMN IF NOT EXISTS "ageGroup" TEXT NOT NULL DEFAULT '6-8',
ADD COLUMN IF NOT EXISTS "presetAvatarId" TEXT NOT NULL DEFAULT 'bunny-wizard';

UPDATE "child_profiles"
SET "ageGroup" = CASE
  WHEN "age" ~ '^[0-5]($|[^0-9])' THEN '3-5'
  WHEN "age" ~ '^[6-8]($|[^0-9])' THEN '6-8'
  WHEN "age" ~ '^(9|10|11|12)($|[^0-9])' THEN '9-12'
  WHEN "age" IN ('2-4', '3-5', '4-6') THEN '3-5'
  WHEN "age" IN ('6-8', '6-10') THEN '6-8'
  WHEN "age" IN ('9-12', '10-13') THEN '9-12'
  ELSE "ageGroup"
END;

ALTER TABLE "characters"
ADD COLUMN IF NOT EXISTS "presetAvatarId" TEXT NOT NULL DEFAULT 'fox-lantern';
