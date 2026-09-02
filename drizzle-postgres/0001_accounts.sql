CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounts_email"
  ON "accounts" USING btree ("email");

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "expires_at" bigint NOT NULL,
  "created_at" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_user_sessions_user"
  ON "user_sessions" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_expires"
  ON "user_sessions" USING btree ("expires_at");

CREATE TABLE IF NOT EXISTS "auth_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "key_hash" text NOT NULL,
  "attempted_at" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_auth_attempts_key"
  ON "auth_attempts" USING btree ("key_hash");

ALTER TABLE "published_sites"
  ADD COLUMN IF NOT EXISTS "user_id" text REFERENCES "accounts"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "idx_published_sites_user"
  ON "published_sites" USING btree ("user_id");
