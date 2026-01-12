import fp from 'fastify-plugin';
import { type FastifyPluginAsync } from 'fastify';
import { FirebaseRegistry } from '@push-platform/shared';

declare module 'fastify' {
  interface FastifyInstance {
    firebase: FirebaseRegistry;
  }
}

const firebasePlugin: FastifyPluginAsync = async (fastify) => {
  // Get Firebase registry singleton
  const registry = FirebaseRegistry.getInstance();

  // Register Firebase registry
  fastify.decorate('firebase', registry);

  // Log successful registration
  fastify.log.info('Firebase registry registered');

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    fastify.log.info('Cleaning up Firebase apps...');
    await registry.cleanup();
    fastify.log.info('Firebase apps cleaned up');
  });
};

export default fp(firebasePlugin, {
  name: 'firebase',
});
