import { bigint, index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (table) => [uniqueIndex('idx_accounts_email').on(table.email)],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('idx_user_sessions_user').on(table.userId),
    index('idx_user_sessions_expires').on(table.expiresAt),
  ],
);

export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: text('id').primaryKey(),
    keyHash: text('key_hash').notNull(),
    attemptedAt: bigint('attempted_at', { mode: 'number' }).notNull(),
  },
  (table) => [index('idx_auth_attempts_key').on(table.keyHash)],
);

export const publishedSites = pgTable(
  'published_sites',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    html: text('html').notNull(),
    pagesJson: text('pages_json').notNull().default('[]'),
    sourcePrompt: text('source_prompt').notNull(),
    customDomain: text('custom_domain'),
    domainStatus: text('domain_status').notNull().default('none'),
    userId: text('user_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_published_sites_slug').on(table.slug),
    uniqueIndex('idx_published_sites_custom_domain').on(table.customDomain),
    index('idx_published_sites_user').on(table.userId),
  ],
);
