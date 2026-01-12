import '@dotenvx/dotenvx/config';
import { buildServer } from './server.js';
import { getEnvNumber } from '@push-platform/shared';

async function start() {
  const server = await buildServer();

  const port = getEnvNumber('API_PORT', 3000);
  const host = process.env.API_HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
    console.log(`Documentation available at http://${host}:${port}/documentation`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      server.log.info(`Received ${signal}, closing server...`);
      await server.close();
      server.log.info('Server closed');
      process.exit(0);
    });
  }
}

start();
