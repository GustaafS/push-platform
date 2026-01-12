import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { applications } from './applications.js';
import { tenants } from './tenants.js';
import { devices } from './devices.js';

export const onboardingTokens = pgTable('onboarding_tokens', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: index('onboarding_tokens_token_idx').on(table.token),
  expiresUsedIdx: index('onboarding_tokens_expires_used_idx').on(table.expiresAt, table.usedAt),
}));
