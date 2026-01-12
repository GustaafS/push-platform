import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  applications,
  tenants,
  devices,
  deviceTokens,
  onboardingTokens,
  pushMessages,
  pushDeliveries,
} from '@push-platform/db';

// Select types (for reading from database)
export type Application = InferSelectModel<typeof applications>;
export type Tenant = InferSelectModel<typeof tenants>;
export type Device = InferSelectModel<typeof devices>;
export type DeviceToken = InferSelectModel<typeof deviceTokens>;
export type OnboardingToken = InferSelectModel<typeof onboardingTokens>;
export type PushMessage = InferSelectModel<typeof pushMessages>;
export type PushDelivery = InferSelectModel<typeof pushDeliveries>;

// Insert types (for creating new records)
export type NewApplication = InferInsertModel<typeof applications>;
export type NewTenant = InferInsertModel<typeof tenants>;
export type NewDevice = InferInsertModel<typeof devices>;
export type NewDeviceToken = InferInsertModel<typeof deviceTokens>;
export type NewOnboardingToken = InferInsertModel<typeof onboardingTokens>;
export type NewPushMessage = InferInsertModel<typeof pushMessages>;
export type NewPushDelivery = InferInsertModel<typeof pushDeliveries>;
