-- Add normalizedEmail column
ALTER TABLE "users" ADD COLUMN "normalizedEmail" TEXT NOT NULL DEFAULT '';

-- Fill existing rows with lowercased email
UPDATE "users" SET "normalizedEmail" = LOWER("email");

-- Drop default after backfill
ALTER TABLE "users" ALTER COLUMN "normalizedEmail" DROP DEFAULT;

-- Add unique index on normalizedEmail
CREATE UNIQUE INDEX "users_normalizedEmail_key" ON "users"("normalizedEmail");
CREATE INDEX "users_normalizedEmail_idx" ON "users"("normalizedEmail");

-- Add emailVerifiedAt column
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Drop old unique index on email
DROP INDEX IF EXISTS "users_email_key";

-- Create email_verifications table
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "email_verifications"("tokenHash");
CREATE INDEX "email_verifications_tokenHash_idx" ON "email_verifications"("tokenHash");
CREATE INDEX "email_verifications_userId_idx" ON "email_verifications"("userId");

-- Create password_resets table
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_resets_tokenHash_key" ON "password_resets"("tokenHash");
CREATE INDEX "password_resets_tokenHash_idx" ON "password_resets"("tokenHash");
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");

ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
