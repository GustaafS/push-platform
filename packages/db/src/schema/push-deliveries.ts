import { pgTable, uuid, varchar, text, integer, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pushMessages } from './push-messages.js';
import { deviceTokens } from './device-tokens.js';

export const deliveryStatusEnum = pgEnum('delivery_status', ['queued', 'sent', 'failed', 'invalid_token']);

export const pushDeliveries = pgTable('push_deliveries', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  messageId: uuid('message_id').notNull().references(() => pushMessages.id, { onDelete: 'cascade' }),
  deviceTokenId: uuid('device_token_id').notNull().references(() => deviceTokens.id, { onDelete: 'cascade' }),
  status: deliveryStatusEnum('status').notNull().default('queued'),
  fcmMessageId: varchar('fcm_message_id', { length: 255 }),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusRetryIdx: index('push_deliveries_status_retry_idx').on(table.status, table.nextRetryAt),
}));
