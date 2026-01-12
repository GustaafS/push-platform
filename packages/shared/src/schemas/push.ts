import { z } from 'zod';

export const pushCreateRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  body: z.string().min(1, 'Body is required'),
  data: z.record(z.unknown()).optional(),
  topic: z.string().optional(),
  deviceIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => (data.topic && !data.deviceIds) || (!data.topic && data.deviceIds),
  {
    message: 'Either topic or deviceIds must be provided, but not both',
  }
);

export type PushCreateRequest = z.infer<typeof pushCreateRequestSchema>;

export const pushCreateResponseSchema = z.object({
  messageId: z.string().uuid(),
  deliveryCount: z.number(),
  status: z.string(),
});

export type PushCreateResponse = z.infer<typeof pushCreateResponseSchema>;

export const pushStatusResponseSchema = z.object({
  messageId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  status: z.string(),
  deliveries: z.object({
    queued: z.number(),
    sent: z.number(),
    failed: z.number(),
    invalid: z.number(),
  }),
});

export type PushStatusResponse = z.infer<typeof pushStatusResponseSchema>;
