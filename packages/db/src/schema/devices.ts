import { pgTable, uuid, varchar, boolean, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { applications } from './applications.js';
import { tenants } from './tenants.js';

export const platformEnum = pgEnum('platform', ['ios', 'android']);

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  installId: varchar('install_id', { length: 255 }).notNull().unique(),
  platform: platformEnum('platform').notNull(),
  appVersion: varchar('app_version', { length: 50 }),
  osVersion: varchar('os_version', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  applicationTenantIdx: index('devices_application_tenant_idx').on(table.applicationId, table.tenantId),
}));
