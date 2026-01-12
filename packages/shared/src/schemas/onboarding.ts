import { z } from 'zod';

export const onboardResolveRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type OnboardResolveRequest = z.infer<typeof onboardResolveRequestSchema>;

export const onboardResolveResponseSchema = z.object({
  applicationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
  tenant: z.object({
    name: z.string(),
    slug: z.string(),
  }),
});

export type OnboardResolveResponse = z.infer<typeof onboardResolveResponseSchema>;
