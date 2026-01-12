import { type FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, isNull, gt, sql } from 'drizzle-orm';
import { applications, tenants, onboardingTokens } from '@push-platform/db';
import { NotFoundError, GoneError } from '@push-platform/shared';

const onboardRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Params: { appSlug: string };
    Body: { token: string };
  }>(
    '/:appSlug/onboard/resolve',
    {
      schema: {
        params: Type.Object({
          appSlug: Type.String(),
        }),
        body: Type.Object({
          token: Type.String({ minLength: 1 }),
        }),
        response: {
          200: Type.Object({
            applicationId: Type.String({ format: 'uuid' }),
            tenantId: Type.String({ format: 'uuid' }),
            metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
            tenant: Type.Object({
              name: Type.String(),
              slug: Type.String(),
            }),
          }),
        },
        tags: ['Onboarding'],
        description: 'Resolve an onboarding token to get tenant and application context',
      },
    },
    async (request, reply) => {
      const { appSlug } = request.params;
      const { token } = request.body;

      // Validate application exists
      const app = await fastify.db.query.applications.findFirst({
        where: eq(applications.slug, appSlug),
      });

      if (!app) {
        throw new NotFoundError(`Application not found: ${appSlug}`);
      }

      // Query onboarding token with tenant info
      const onboardingToken = await fastify.db.query.onboardingTokens.findFirst({
        where: eq(onboardingTokens.token, token),
        with: {
          tenant: true,
        },
      });

      if (!onboardingToken) {
        throw new NotFoundError('Onboarding token not found');
      }

      // Check if token belongs to the application
      if (onboardingToken.applicationId !== app.id) {
        throw new NotFoundError('Onboarding token not found');
      }

      // Check if token is expired
      if (onboardingToken.expiresAt < new Date()) {
        throw new GoneError('Onboarding token has expired');
      }

      // Check if token has already been used
      if (onboardingToken.usedAt) {
        throw new GoneError('Onboarding token has already been used');
      }

      fastify.log.info({
        action: 'onboarding_token_resolved',
        applicationId: app.id,
        tenantId: onboardingToken.tenantId,
        token: token.substring(0, 8) + '...',
      });

      // Get tenant info
      const tenant = await fastify.db.query.tenants.findFirst({
        where: eq(tenants.id, onboardingToken.tenantId),
      });

      if (!tenant) {
        throw new NotFoundError('Tenant not found');
      }

      return {
        applicationId: app.id,
        tenantId: onboardingToken.tenantId,
        metadata: onboardingToken.metadata as Record<string, unknown> | undefined,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
        },
      };
    }
  );
};

export default onboardRoute;
