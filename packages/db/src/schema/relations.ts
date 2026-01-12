import { relations } from 'drizzle-orm';
import { applications } from './applications.js';
import { tenants } from './tenants.js';
import { devices } from './devices.js';
import { deviceTokens } from './device-tokens.js';
import { onboardingTokens } from './onboarding-tokens.js';
import { pushMessages } from './push-messages.js';
import { pushDeliveries } from './push-deliveries.js';

// Application relations
export const applicationsRelations = relations(applications, ({ many }) => ({
  tenants: many(tenants),
  devices: many(devices),
  onboardingTokens: many(onboardingTokens),
  pushMessages: many(pushMessages),
}));

// Tenant relations
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  application: one(applications, {
    fields: [tenants.applicationId],
    references: [applications.id],
  }),
  devices: many(devices),
  onboardingTokens: many(onboardingTokens),
  pushMessages: many(pushMessages),
}));

// Device relations
export const devicesRelations = relations(devices, ({ one, many }) => ({
  application: one(applications, {
    fields: [devices.applicationId],
    references: [applications.id],
  }),
  tenant: one(tenants, {
    fields: [devices.tenantId],
    references: [tenants.id],
  }),
  deviceTokens: many(deviceTokens),
  onboardingTokens: many(onboardingTokens),
}));

// Device token relations
export const deviceTokensRelations = relations(deviceTokens, ({ one, many }) => ({
  device: one(devices, {
    fields: [deviceTokens.deviceId],
    references: [devices.id],
  }),
  pushDeliveries: many(pushDeliveries),
}));

// Onboarding token relations
export const onboardingTokensRelations = relations(onboardingTokens, ({ one }) => ({
  application: one(applications, {
    fields: [onboardingTokens.applicationId],
    references: [applications.id],
  }),
  tenant: one(tenants, {
    fields: [onboardingTokens.tenantId],
    references: [tenants.id],
  }),
  device: one(devices, {
    fields: [onboardingTokens.deviceId],
    references: [devices.id],
  }),
}));

// Push message relations
export const pushMessagesRelations = relations(pushMessages, ({ one, many }) => ({
  application: one(applications, {
    fields: [pushMessages.applicationId],
    references: [applications.id],
  }),
  tenant: one(tenants, {
    fields: [pushMessages.tenantId],
    references: [tenants.id],
  }),
  deliveries: many(pushDeliveries),
}));

// Push delivery relations
export const pushDeliveriesRelations = relations(pushDeliveries, ({ one }) => ({
  message: one(pushMessages, {
    fields: [pushDeliveries.messageId],
    references: [pushMessages.id],
  }),
  deviceToken: one(deviceTokens, {
    fields: [pushDeliveries.deviceTokenId],
    references: [deviceTokens.id],
  }),
}));
