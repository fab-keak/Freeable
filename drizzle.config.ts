import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './drizzle-postgres',
  schema: './db/schema.ts',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost/canvas',
  },
});
