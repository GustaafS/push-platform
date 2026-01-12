import { pgTable, uuid, varchar, text, jsonb, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { applications } from './applications.js';
import { tenants } from './tenants.js';

export const messageStatusEnum = pgEnum('message_status', ['pending', 'processing', 'completed', 'failed']);

export const pushMessages = pgTable('push_messages', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  topic: varchar('topic', { length: 255 }),
  deviceIds: uuid('device_ids').array(),
  status: messageStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  applicationTenantIdx: index('push_messages_application_tenant_idx').on(table.applicationId, table.tenantId),
}));
