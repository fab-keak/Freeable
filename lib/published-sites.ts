import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const createPublishedSitesTable = `
  CREATE TABLE IF NOT EXISTS published_sites (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    html TEXT NOT NULL,
    source_prompt TEXT NOT NULL,
    custom_domain TEXT,
    domain_status TEXT NOT NULL DEFAULT 'none',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )
`;

const createSlugIndex = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_published_sites_slug
  ON published_sites (slug)
`;

let database: NeonQueryFunction<false, false> | null = null;
let initialization: Promise<void> | null = null;

export async function getPublishedSitesDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('Published-site storage is not configured.');

  database ??= neon(databaseUrl);
  const sql = database;

  initialization ??= (async () => {
    await sql.query(createPublishedSitesTable);
    await sql.query(createSlugIndex);
    await sql.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_published_sites_custom_domain
       ON published_sites (custom_domain)
       WHERE custom_domain IS NOT NULL`,
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
