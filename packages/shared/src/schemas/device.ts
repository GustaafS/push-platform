import { z } from 'zod';

export const platformSchema = z.enum(['ios', 'android']);

export const deviceRegisterRequestSchema = z.object({
  onboardingToken: z.string().min(1, 'Onboarding token is required'),
  installId: z.string().min(1, 'Install ID is required'),
  fcmToken: z.string().min(1, 'FCM token is required'),
  platform: platformSchema,
  appVersion: z.string().optional(),
  osVersion: z.string().optional(),
  topics: z.array(z.string()).optional(),
});

export type DeviceRegisterRequest = z.infer<typeof deviceRegisterRequestSchema>;

export const deviceRegisterResponseSchema = z.object({
  deviceId: z.string().uuid(),
  success: z.boolean(),
});

export type DeviceRegisterResponse = z.infer<typeof deviceRegisterResponseSchema>;

export const deviceHeartbeatRequestSchema = z.object({
  installId: z.string().min(1, 'Install ID is required'),
});

export type DeviceHeartbeatRequest = z.infer<typeof deviceHeartbeatRequestSchema>;

export const deviceHeartbeatResponseSchema = z.object({
  success: z.boolean(),
});

export type DeviceHeartbeatResponse = z.infer<typeof deviceHeartbeatResponseSchema>;
