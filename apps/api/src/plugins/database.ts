import fp from 'fastify-plugin';
import { type FastifyPluginAsync } from 'fastify';
import { db, type DbClient } from '@push-platform/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: DbClient;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  // Register database client
  fastify.decorate('db', db);

  // Log successful connection
  fastify.log.info('Database client registered');

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    fastify.log.info('Database connection closed');
  });
};

export default fp(databasePlugin, {
  name: 'database',
});
