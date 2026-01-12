import fp from 'fastify-plugin';
import { type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify';
import { UnauthorizedError, getEnvArray } from '@push-platform/shared';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Get valid API keys from environment
  const validApiKeys = getEnvArray('API_KEYS', []);

  if (validApiKeys.length === 0) {
    fastify.log.warn('No API keys configured. Authentication will fail for protected routes.');
  }

  // Authentication hook
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedError('API key required. Provide X-API-Key header.');
    }

    if (typeof apiKey !== 'string') {
      throw new UnauthorizedError('Invalid API key format');
    }

    if (!validApiKeys.includes(apiKey)) {
      throw new UnauthorizedError('Invalid API key');
    }

    // API key is valid, continue
  };

  // Register authenticate decorator
  fastify.decorate('authenticate', authenticate);

  fastify.log.info('Authentication plugin registered');
};

export default fp(authPlugin, {
  name: 'auth',
});
