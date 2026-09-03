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

async function isPublishedSitesSchemaReady(sql: ReturnType<typeof postgres>) {
  const rows = await sql`
    SELECT
      to_regclass('public.accounts') IS NOT NULL AS accounts_ready,
      to_regclass('public.published_sites') IS NOT NULL AS sites_ready,
      to_regclass('public.user_sessions') IS NOT NULL AS sessions_ready,
      to_regclass('public.auth_attempts') IS NOT NULL AS attempts_ready,
      to_regclass('public.domain_orders') IS NOT NULL AS orders_ready,
      to_regclass('public.site_traffic_daily') IS NOT NULL AS traffic_ready,
      to_regclass('public.idx_accounts_email') IS NOT NULL AS accounts_index_ready,
      to_regclass('public.idx_published_sites_slug') IS NOT NULL AS slug_index_ready,
      to_regclass('public.idx_published_sites_custom_domain') IS NOT NULL AS domain_index_ready,
      to_regclass('public.idx_published_sites_user') IS NOT NULL AS sites_user_index_ready,
      to_regclass('public.idx_site_traffic_daily_date') IS NOT NULL AS traffic_index_ready,
      (
        SELECT COUNT(*) = 4
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'published_sites'
          AND column_name IN ('pages_json', 'user_id', 'custom_domain', 'domain_status')
      ) AS site_columns_ready
  `;
  const status = rows[0] as Record<string, boolean> | undefined;
  return Boolean(status && Object.values(status).every(Boolean));
}

export async function getPublishedSitesDatabase() {
  const databaseUrl =
    process.env.DATABASE_POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('Published-site storage is not configured.');

  database ??= postgres(databaseUrl, {
    max: 3,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 10,
    max_lifetime: 60,
    keep_alive: 30,
    connection: {
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    },
    onnotice: () => undefined,
  });
  const sql = database;

  initialization ??= (async () => {
    // Serverless instances start independently. Avoid repeating locking DDL on
    // every cold start once the production schema is already complete.
    if (await isPublishedSitesSchemaReady(sql)) return;

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
    await sql.unsafe(createSlugIndex);
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
      `CREATE TABLE IF NOT EXISTS domain_orders (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        site_slug TEXT NOT NULL REFERENCES published_sites(slug) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        renewal_price_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'usd',
        years INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'checkout_pending',
        stripe_session_id TEXT UNIQUE,
        payment_intent_id TEXT,
        vercel_order_id TEXT,
        failure_message TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`,
    );
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_domain_orders_user
       ON domain_orders (user_id, created_at DESC)`,
    );
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_domain_orders_domain
       ON domain_orders (domain, status)`,
    );
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS site_traffic_daily (
        site_slug TEXT NOT NULL REFERENCES published_sites(slug) ON DELETE CASCADE,
        view_date TEXT NOT NULL,
        page_path TEXT NOT NULL DEFAULT '',
        views BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (site_slug, view_date, page_path)
      )`,
    );
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_site_traffic_daily_date
       ON site_traffic_daily (view_date DESC)`,
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
