import type { Config } from 'drizzle-kit';

export default {
  schema: './dist/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/push_platform',
  },
} satisfies Config;
