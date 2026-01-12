// Token expiry
export const DEFAULT_TOKEN_EXPIRY_HOURS = 24;
export const DEFAULT_TOKEN_EXPIRY_MS = DEFAULT_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

// Retry configuration
export const MAX_RETRY_COUNT = 5;

// Worker configuration
export const DEFAULT_POLL_INTERVAL_MS = 10000; // 10 seconds
export const DEFAULT_BATCH_SIZE = 100;

// Platform values
export const PLATFORMS = {
  IOS: 'ios',
  ANDROID: 'android',
} as const;

// Message status values
export const MESSAGE_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Delivery status values
export const DELIVERY_STATUSES = {
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed',
  INVALID_TOKEN: 'invalid_token',
} as const;

// Terminal delivery statuses (no further processing)
export const TERMINAL_DELIVERY_STATUSES = [
  DELIVERY_STATUSES.SENT,
  DELIVERY_STATUSES.FAILED,
  DELIVERY_STATUSES.INVALID_TOKEN,
] as const;

// FCM error codes that indicate invalid registration
export const INVALID_REGISTRATION_ERRORS = [
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-recipient',
] as const;

// FCM error codes that are transient and should be retried
export const TRANSIENT_FCM_ERRORS = [
  'messaging/server-unavailable',
  'messaging/internal-error',
  'messaging/unavailable',
] as const;
