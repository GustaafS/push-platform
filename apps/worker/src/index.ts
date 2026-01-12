import '@dotenvx/dotenvx/config';
import { db } from '@push-platform/db';
import { getEnvNumber } from '@push-platform/shared';
import { DeliveryProcessor } from './processor.js';
import pino from 'pino';

const logger = pino({
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
});

async function start() {
  logger.info('Starting push delivery worker...');

  const pollInterval = getEnvNumber('WORKER_POLL_INTERVAL_MS', 10000);
  const batchSize = getEnvNumber('WORKER_BATCH_SIZE', 100);

  const processor = new DeliveryProcessor(db, batchSize);

  let isRunning = true;
  let processingPromise: Promise<void> | null = null;

  // Worker loop
  const processLoop = async () => {
    while (isRunning) {
      try {
        const processed = await processor.processBatch();

        if (processed > 0) {
          logger.debug(`Processed ${processed} deliveries`);
        }
      } catch (error) {
        logger.error({
          action: 'worker_loop_error',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Wait before next iteration
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    logger.info('Worker loop stopped');
  };

  // Start processing loop
  processingPromise = processLoop();

  logger.info(`Worker started. Polling every ${pollInterval}ms, batch size: ${batchSize}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    isRunning = false;
    processor.shutdown();

    // Wait for current processing to finish
    if (processingPromise) {
      await processingPromise;
    }

    logger.info('Worker stopped');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  logger.error({
    action: 'worker_start_error',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
