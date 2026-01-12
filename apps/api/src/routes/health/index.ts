import { type FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (request, reply) => {
    try {
      // Check database connectivity
      await fastify.db.execute(sql`SELECT 1`);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'connected',
      };
    } catch (error) {
      fastify.log.error('Health check failed:', error);
      reply.status(503);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'disconnected',
      };
    }
  });
};

export default healthRoute;
