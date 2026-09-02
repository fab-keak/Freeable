CREATE TABLE IF NOT EXISTS "published_sites" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "html" text NOT NULL,
  "source_prompt" text NOT NULL,
  "custom_domain" text,
  "domain_status" text DEFAULT 'none' NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_published_sites_slug"
  ON "published_sites" USING btree ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_published_sites_custom_domain"
  ON "published_sites" USING btree ("custom_domain")
  WHERE "custom_domain" IS NOT NULL;
