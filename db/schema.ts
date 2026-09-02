import { bigint, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const publishedSites = pgTable(
  'published_sites',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    html: text('html').notNull(),
    sourcePrompt: text('source_prompt').notNull(),
    customDomain: text('custom_domain'),
    domainStatus: text('domain_status').notNull().default('none'),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_published_sites_slug').on(table.slug),
    uniqueIndex('idx_published_sites_custom_domain').on(table.customDomain),
  ],
);
