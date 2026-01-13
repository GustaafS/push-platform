import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import autoload from '@fastify/autoload';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppError } from '@push-platform/shared';

// Import routes manually for ESM compatibility
import healthRoute from './routes/health/index.js';
import onboardRoute from './routes/v1/onboard/index.js';
import devicesRoute from './routes/v1/devices/index.js';
import pushRoute from './routes/v1/push/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Register rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    cache: 10000,
  });

  // Register Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Push Platform API',
        description: 'Generic Push Notification Platform API',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register plugins
  await fastify.register(autoload, {
    dir: join(__dirname, 'plugins'),
    options: { prefix: '' },
    forceESM: true,
  });

  // Register routes manually for ESM compatibility
  await fastify.register(healthRoute);
  await fastify.register(onboardRoute, { prefix: '/v1' });
  await fastify.register(devicesRoute, { prefix: '/v1' });
  await fastify.register(pushRoute, { prefix: '/v1' });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
    } else if (error.validation) {
      reply.status(400).send({
        error: 'Validation error',
        details: error.validation,
        statusCode: 400,
      });
    } else {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal server error',
        statusCode: 500,
      });
    }
  });

  return fastify;
}
