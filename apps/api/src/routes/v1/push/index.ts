import { type FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { applications, pushMessages, pushDeliveries, deviceTokens, devices } from '@push-platform/db';
import { NotFoundError, ValidationError } from '@push-platform/shared';

const pushRoute: FastifyPluginAsync = async (fastify) => {
  // POST /:appSlug/push - Create push notification
  fastify.post<{
    Params: { appSlug: string };
    Body: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      topic?: string;
      deviceIds?: string[];
    };
  }>(
    '/:appSlug/push',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: Type.Object({
          appSlug: Type.String(),
        }),
        body: Type.Object({
          title: Type.String({ minLength: 1, maxLength: 255 }),
          body: Type.String({ minLength: 1 }),
          data: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
          topic: Type.Optional(Type.String()),
          deviceIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
        }),
        response: {
          200: Type.Object({
            messageId: Type.String({ format: 'uuid' }),
            deliveryCount: Type.Number(),
            status: Type.String(),
          }),
        },
        tags: ['Push Notifications'],
        description: 'Create a push notification (requires X-API-Key)',
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const { appSlug } = request.params;
      const { title, body, data, topic, deviceIds } = request.body;

      // Validate either topic or deviceIds is provided
      if ((!topic && !deviceIds) || (topic && deviceIds)) {
        throw new ValidationError('Either topic or deviceIds must be provided, but not both');
      }

      // Validate application exists
      const app = await fastify.db.query.applications.findFirst({
        where: eq(applications.slug, appSlug),
      });

      if (!app) {
        throw new NotFoundError(`Application not found: ${appSlug}`);
      }

      // For simplicity in MVP, we'll use the first tenant of the application
      // In production, tenant would come from auth context
      const appTenants = await fastify.db.query.tenants.findMany({
        where: eq(applications.id, app.id),
        limit: 1,
      });

      if (appTenants.length === 0) {
        throw new NotFoundError('No tenants found for application');
      }

      const tenantId = appTenants[0].id;

      // Create push message and delivery records in a transaction
      const result = await fastify.db.transaction(async (tx) => {
        // Create push message
        const [message] = await tx
          .insert(pushMessages)
          .values({
            applicationId: app.id,
            tenantId,
            title,
            body,
            data: data || null,
            topic: topic || null,
            deviceIds: deviceIds || null,
            status: 'pending',
          })
          .returning();

        // Resolve target device tokens
        let targetTokenIds: string[] = [];

        if (topic) {
          // Topic-based targeting: find all device tokens with this topic
          const tokens = await tx
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .innerJoin(devices, eq(devices.id, deviceTokens.deviceId))
            .where(
              and(
                eq(devices.applicationId, app.id),
                eq(devices.tenantId, tenantId),
                eq(devices.isActive, true),
                eq(deviceTokens.isValid, true),
                sql`${topic} = ANY(${deviceTokens.topics})`
              )
            );

          targetTokenIds = tokens.map((t) => t.id);
        } else if (deviceIds && deviceIds.length > 0) {
          // Device-list targeting: find device tokens for specified devices
          const tokens = await tx
            .select({ id: deviceTokens.id })
            .from(deviceTokens)
            .innerJoin(devices, eq(devices.id, deviceTokens.deviceId))
            .where(
              and(
                inArray(devices.id, deviceIds),
                eq(devices.applicationId, app.id),
                eq(devices.tenantId, tenantId),
                eq(deviceTokens.isValid, true)
              )
            );

          targetTokenIds = tokens.map((t) => t.id);

          if (targetTokenIds.length !== deviceIds.length) {
            fastify.log.warn({
              action: 'push_device_mismatch',
              requested: deviceIds.length,
              found: targetTokenIds.length,
            });
          }
        }

        // Create delivery records for each target token
        if (targetTokenIds.length > 0) {
          await tx.insert(pushDeliveries).values(
            targetTokenIds.map((tokenId) => ({
              messageId: message.id,
              deviceTokenId: tokenId,
              status: 'queued' as const,
              retryCount: 0,
            }))
          );
        }

        fastify.log.info({
          action: 'push_message_created',
          messageId: message.id,
          applicationId: app.id,
          tenantId,
          deliveryCount: targetTokenIds.length,
          targetingMode: topic ? 'topic' : 'deviceIds',
        });

        return {
          messageId: message.id,
          deliveryCount: targetTokenIds.length,
        };
      });

      return {
        messageId: result.messageId,
        deliveryCount: result.deliveryCount,
        status: 'queued',
      };
    }
  );

  // GET /:appSlug/push/:messageId - Get push message status
  fastify.get<{
    Params: { appSlug: string; messageId: string };
  }>(
    '/:appSlug/push/:messageId',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: Type.Object({
          appSlug: Type.String(),
          messageId: Type.String({ format: 'uuid' }),
        }),
        response: {
          200: Type.Object({
            messageId: Type.String({ format: 'uuid' }),
            title: Type.String(),
            body: Type.String(),
            status: Type.String(),
            deliveries: Type.Object({
              queued: Type.Number(),
              sent: Type.Number(),
              failed: Type.Number(),
              invalid: Type.Number(),
            }),
          }),
        },
        tags: ['Push Notifications'],
        description: 'Get push message status and delivery statistics',
        security: [{ apiKey: [] }],
      },
    },
    async (request, reply) => {
      const { appSlug, messageId } = request.params;

      // Validate application exists
      const app = await fastify.db.query.applications.findFirst({
        where: eq(applications.slug, appSlug),
      });

      if (!app) {
        throw new NotFoundError(`Application not found: ${appSlug}`);
      }

      // Get message
      const message = await fastify.db.query.pushMessages.findFirst({
        where: and(eq(pushMessages.id, messageId), eq(pushMessages.applicationId, app.id)),
      });

      if (!message) {
        throw new NotFoundError('Push message not found');
      }

      // Get delivery statistics
      const stats = await fastify.db
        .select({
          status: pushDeliveries.status,
          count: sql<number>`count(*)::int`,
        })
        .from(pushDeliveries)
        .where(eq(pushDeliveries.messageId, messageId))
        .groupBy(pushDeliveries.status);

      const deliveries = {
        queued: 0,
        sent: 0,
        failed: 0,
        invalid: 0,
      };

      for (const stat of stats) {
        if (stat.status === 'queued') deliveries.queued = stat.count;
        if (stat.status === 'sent') deliveries.sent = stat.count;
        if (stat.status === 'failed') deliveries.failed = stat.count;
        if (stat.status === 'invalid_token') deliveries.invalid = stat.count;
      }

      return {
        messageId: message.id,
        title: message.title,
        body: message.body,
        status: message.status,
        deliveries,
      };
    }
  );
};

export default pushRoute;
