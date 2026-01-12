import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { devices } from './devices.js';

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  fcmToken: varchar('fcm_token', { length: 255 }).notNull().unique(),
  topics: text('topics').array(),
  isValid: boolean('is_valid').notNull().default(true),
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  fcmTokenIdx: index('device_tokens_fcm_token_idx').on(table.fcmToken),
}));
