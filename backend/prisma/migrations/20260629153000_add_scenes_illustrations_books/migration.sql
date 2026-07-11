-- Create story_scenes table
CREATE TABLE IF NOT EXISTS "story_scenes" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "style" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_scenes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "story_scenes_storyId_position_key" ON "story_scenes"("storyId", "position");
CREATE INDEX IF NOT EXISTS "story_scenes_storyId_idx" ON "story_scenes"("storyId");
CREATE INDEX IF NOT EXISTS "story_scenes_userId_idx" ON "story_scenes"("userId");
ALTER TABLE "story_scenes" ADD CONSTRAINT "story_scenes_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_scenes" ADD CONSTRAINT "story_scenes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create story_illustrations table
CREATE TABLE IF NOT EXISTS "story_illustrations" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "sceneId" TEXT,
    "userId" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "objectName" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_illustrations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "story_illustrations_storyId_idx" ON "story_illustrations"("storyId");
CREATE INDEX IF NOT EXISTS "story_illustrations_userId_idx" ON "story_illustrations"("userId");
ALTER TABLE "story_illustrations" ADD CONSTRAINT "story_illustrations_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_illustrations" ADD CONSTRAINT "story_illustrations_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "story_scenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "story_illustrations" ADD CONSTRAINT "story_illustrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create book_projects table
CREATE TABLE IF NOT EXISTS "book_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT 'a4',
    "coverSettings" TEXT NOT NULL DEFAULT '{}',
    "pdfObjectName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "book_projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "book_projects_userId_idx" ON "book_projects"("userId");
CREATE INDEX IF NOT EXISTS "book_projects_storyId_idx" ON "book_projects"("storyId");
ALTER TABLE "book_projects" ADD CONSTRAINT "book_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_projects" ADD CONSTRAINT "book_projects_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
