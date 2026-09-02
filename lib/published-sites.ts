import postgres from 'postgres';

const createPublishedSitesTable = `
  CREATE TABLE IF NOT EXISTS published_sites (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    html TEXT NOT NULL,
    pages_json TEXT NOT NULL DEFAULT '[]',
    source_prompt TEXT NOT NULL,
    custom_domain TEXT,
    domain_status TEXT NOT NULL DEFAULT 'none',
    user_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )
`;

const createSlugIndex = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_published_sites_slug
  ON published_sites (slug)
`;

let database: ReturnType<typeof postgres> | null = null;
let initialization: Promise<void> | null = null;

export async function getPublishedSitesDatabase() {
  const databaseUrl =
    process.env.DATABASE_POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('Published-site storage is not configured.');

  database ??= postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  const sql = database;

  initialization ??= (async () => {
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )`,
    );
    await sql.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email
       ON accounts (email)`,
    );
    await sql.unsafe(createPublishedSitesTable);
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      )`,
    );
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_user
       ON user_sessions (user_id)`,
    );
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
       ON user_sessions (expires_at)`,
    );
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS auth_attempts (
        id TEXT PRIMARY KEY NOT NULL,
        key_hash TEXT NOT NULL,
        attempted_at BIGINT NOT NULL
      )`,
    );
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_auth_attempts_key
       ON auth_attempts (key_hash)`,
    );
    await sql.unsafe(
      `ALTER TABLE published_sites
       ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES accounts(id) ON DELETE SET NULL`,
    );
    await sql.unsafe(
      `ALTER TABLE published_sites
       ADD COLUMN IF NOT EXISTS pages_json TEXT NOT NULL DEFAULT '[]'`,
    );
    await sql.unsafe(createSlugIndex);
    await sql.unsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_published_sites_custom_domain
       ON published_sites (custom_domain)
       WHERE custom_domain IS NOT NULL`,
    );
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_published_sites_user
       ON published_sites (user_id)`,
    );
  })();

  try {
    await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }

  return sql;
}
