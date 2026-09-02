ALTER TABLE "published_sites"
  ADD COLUMN IF NOT EXISTS "pages_json" TEXT NOT NULL DEFAULT '[]';
