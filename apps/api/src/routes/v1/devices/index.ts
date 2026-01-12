import { type FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, sql } from 'drizzle-orm';
import { applications, devices, deviceTokens, onboardingTokens } from '@push-platform/db';
import { NotFoundError, GoneError, ValidationError } from '@push-platform/shared';

const devicesRoute: FastifyPluginAsync = async (fastify) => {
  // POST /:appSlug/devices/register
  fastify.post<{
    Params: { appSlug: string };
    Body: {
      onboardingToken: string;
      installId: string;
      fcmToken: string;
      platform: 'ios' | 'android';
      appVersion?: string;
      osVersion?: string;
      topics?: string[];
    };
  }>(
    '/:appSlug/devices/register',
    {
      schema: {
        params: Type.Object({
          appSlug: Type.String(),
        }),
        body: Type.Object({
          onboardingToken: Type.String({ minLength: 1 }),
          installId: Type.String({ minLength: 1 }),
          fcmToken: Type.String({ minLength: 1 }),
          platform: Type.Union([Type.Literal('ios'), Type.Literal('android')]),
          appVersion: Type.Optional(Type.String()),
          osVersion: Type.Optional(Type.String()),
          topics: Type.Optional(Type.Array(Type.String())),
        }),
        response: {
          200: Type.Object({
            deviceId: Type.String({ format: 'uuid' }),
            success: Type.Boolean(),
          }),
        },
        tags: ['Devices'],
        description: 'Register a device with an onboarding token',
      },
    },
    async (request, reply) => {
      const { appSlug } = request.params;
      const { onboardingToken, installId, fcmToken, platform, appVersion, osVersion, topics } = request.body;

      // Validate application exists
      const app = await fastify.db.query.applications.findFirst({
        where: eq(applications.slug, appSlug),
      });

      if (!app) {
        throw new NotFoundError(`Application not found: ${appSlug}`);
      }

      // Validate onboarding token
      const token = await fastify.db.query.onboardingTokens.findFirst({
        where: eq(onboardingTokens.token, onboardingToken),
      });

      if (!token || token.applicationId !== app.id) {
        throw new NotFoundError('Onboarding token not found');
      }

      if (token.expiresAt < new Date()) {
        throw new GoneError('Onboarding token has expired');
      }

      if (token.usedAt) {
        throw new GoneError('Onboarding token has already been used');
      }

      // Use transaction to create/update device, device token, and mark token as used
      const result = await fastify.db.transaction(async (tx) => {
        // Upsert device
        const existingDevice = await tx.query.devices.findFirst({
          where: eq(devices.installId, installId),
        });

        let deviceId: string;

        if (existingDevice) {
          // Update existing device
          await tx
            .update(devices)
            .set({
              isActive: true,
              lastSeenAt: new Date(),
              appVersion,
              osVersion,
              platform,
              updatedAt: new Date(),
            })
            .where(eq(devices.id, existingDevice.id));

          deviceId = existingDevice.id;

          fastify.log.info({
            action: 'device_updated',
            deviceId,
            installId,
          });
        } else {
          // Create new device
          const [newDevice] = await tx
            .insert(devices)
            .values({
              applicationId: app.id,
              tenantId: token.tenantId,
              installId,
              platform,
              appVersion,
              osVersion,
              isActive: true,
              lastSeenAt: new Date(),
            })
            .returning();

          deviceId = newDevice.id;

          fastify.log.info({
            action: 'device_created',
            deviceId,
            installId,
          });
        }

        // Upsert device token
        const existingToken = await tx.query.deviceTokens.findFirst({
          where: eq(deviceTokens.fcmToken, fcmToken),
        });

        if (existingToken) {
          // Update existing token
          await tx
            .update(deviceTokens)
            .set({
              deviceId,
              topics: topics || [],
              isValid: true,
              invalidatedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(deviceTokens.id, existingToken.id));
        } else {
          // Create new device token
          await tx.insert(deviceTokens).values({
            deviceId,
            fcmToken,
            topics: topics || [],
            isValid: true,
          });
        }

        // Mark onboarding token as used
        await tx
          .update(onboardingTokens)
          .set({
            usedAt: new Date(),
            deviceId,
          })
          .where(eq(onboardingTokens.id, token.id));

        return { deviceId };
      });

      fastify.log.info({
        action: 'device_registered',
        deviceId: result.deviceId,
        applicationId: app.id,
        tenantId: token.tenantId,
        platform,
        topics: topics || [],
      });

      return {
        deviceId: result.deviceId,
        success: true,
      };
    }
  );

  // POST /:appSlug/devices/heartbeat
  fastify.post<{
    Params: { appSlug: string };
    Body: { installId: string };
  }>(
    '/:appSlug/devices/heartbeat',
    {
      schema: {
        params: Type.Object({
          appSlug: Type.String(),
        }),
        body: Type.Object({
          installId: Type.String({ minLength: 1 }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
          }),
        },
        tags: ['Devices'],
        description: 'Update device last seen timestamp',
      },
    },
    async (request, reply) => {
      const { appSlug } = request.params;
      const { installId } = request.body;

      // Validate application exists
      const app = await fastify.db.query.applications.findFirst({
        where: eq(applications.slug, appSlug),
      });

      if (!app) {
        throw new NotFoundError(`Application not found: ${appSlug}`);
      }

      // Update last seen
      const result = await fastify.db
        .update(devices)
        .set({
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(devices.installId, installId), eq(devices.applicationId, app.id)))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Device not found');
      }

      fastify.log.info({
        action: 'device_heartbeat',
        deviceId: result[0].id,
        installId,
      });

      return { success: true };
    }
  );
};

export default devicesRoute;
