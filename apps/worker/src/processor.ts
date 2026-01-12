import { eq, and, or, lte, isNull, sql, inArray } from 'drizzle-orm';
import type { DbClient } from '@push-platform/db';
import { pushDeliveries, deviceTokens, pushMessages, devices, applications } from '@push-platform/db';
import {
  FirebaseRegistry,
  MAX_RETRY_COUNT,
  INVALID_REGISTRATION_ERRORS,
  TRANSIENT_FCM_ERRORS,
  TERMINAL_DELIVERY_STATUSES,
} from '@push-platform/shared';
import pino from 'pino';

export class DeliveryProcessor {
  private logger: pino.Logger;
  private firebaseRegistry: FirebaseRegistry;
  private isShuttingDown = false;

  constructor(
    private db: DbClient,
    private batchSize: number = 100
  ) {
    this.logger = pino({
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
    this.firebaseRegistry = FirebaseRegistry.getInstance();
  }

  /**
   * Process a batch of pending deliveries
   */
  async processBatch(): Promise<number> {
    if (this.isShuttingDown) {
      return 0;
    }

    const startTime = Date.now();

    try {
      // Fetch pending deliveries with row-level locking
      const pendingDeliveries = await this.db
        .select({
          id: pushDeliveries.id,
          messageId: pushDeliveries.messageId,
          deviceTokenId: pushDeliveries.deviceTokenId,
          retryCount: pushDeliveries.retryCount,
        })
        .from(pushDeliveries)
        .where(
          and(
            eq(pushDeliveries.status, 'queued'),
            or(isNull(pushDeliveries.nextRetryAt), lte(pushDeliveries.nextRetryAt, new Date()))
          )
        )
        .limit(this.batchSize)
        .for('update', { skipLocked: true });

      if (pendingDeliveries.length === 0) {
        return 0;
      }

      this.logger.info({
        action: 'batch_start',
        count: pendingDeliveries.length,
      });

      // Process each delivery
      let successCount = 0;
      let failureCount = 0;

      for (const delivery of pendingDeliveries) {
        try {
          await this.processDelivery(delivery);
          successCount++;
        } catch (error) {
          this.logger.error({
            action: 'delivery_processing_error',
            deliveryId: delivery.id,
            error: error instanceof Error ? error.message : String(error),
          });
          failureCount++;
        }
      }

      const duration = Date.now() - startTime;

      this.logger.info({
        action: 'batch_complete',
        count: pendingDeliveries.length,
        success: successCount,
        failure: failureCount,
        duration,
      });

      // Update message statuses for completed messages
      await this.updateMessageStatuses();

      return pendingDeliveries.length;
    } catch (error) {
      this.logger.error({
        action: 'batch_error',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Process a single delivery
   */
  private async processDelivery(delivery: {
    id: string;
    messageId: string;
    deviceTokenId: string;
    retryCount: number;
  }): Promise<void> {
    // Get delivery details with related data
    const deliveryDetails = await this.db.query.pushDeliveries.findFirst({
      where: eq(pushDeliveries.id, delivery.id),
      with: {
        message: true,
        deviceToken: {
          with: {
            device: {
              with: {
                application: true,
              },
            },
          },
        },
      },
    });

    if (!deliveryDetails) {
      this.logger.warn({
        action: 'delivery_not_found',
        deliveryId: delivery.id,
      });
      return;
    }

    const { message, deviceToken } = deliveryDetails;

    if (!deviceToken) {
      this.logger.error({
        action: 'device_token_not_found',
        deliveryId: delivery.id,
      });
      await this.markDeliveryFailed(delivery.id, 'DEVICE_TOKEN_NOT_FOUND', 'Device token not found');
      return;
    }

    const device = deviceToken.device;
    if (!device) {
      this.logger.error({
        action: 'device_not_found',
        deliveryId: delivery.id,
      });
      await this.markDeliveryFailed(delivery.id, 'DEVICE_NOT_FOUND', 'Device not found');
      return;
    }

    const application = device.application;
    if (!application) {
      this.logger.error({
        action: 'application_not_found',
        deliveryId: delivery.id,
      });
      await this.markDeliveryFailed(delivery.id, 'APPLICATION_NOT_FOUND', 'Application not found');
      return;
    }

    try {
      // Get Firebase messaging client
      const messaging = await this.firebaseRegistry.getMessaging(
        application.id,
        application.firebaseConfig as Record<string, unknown> | undefined
      );

      // Build FCM message
      const fcmMessage = {
        token: deviceToken.fcmToken,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data ? this.convertDataToStrings(message.data as Record<string, unknown>) : undefined,
      };

      // Send message via FCM
      const response = await messaging.send(fcmMessage);

      // Mark as sent
      await this.db
        .update(pushDeliveries)
        .set({
          status: 'sent',
          sentAt: new Date(),
          fcmMessageId: response,
          updatedAt: new Date(),
        })
        .where(eq(pushDeliveries.id, delivery.id));

      this.logger.info({
        action: 'delivery_sent',
        deliveryId: delivery.id,
        messageId: message.id,
        fcmMessageId: response,
      });
    } catch (error: any) {
      await this.handleFCMError(delivery, error);
    }
  }

  /**
   * Convert data object to strings (FCM requirement)
   */
  private convertDataToStrings(data: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  /**
   * Handle FCM errors
   */
  private async handleFCMError(
    delivery: { id: string; messageId: string; retryCount: number },
    error: any
  ): Promise<void> {
    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = error.message || String(error);

    this.logger.error({
      action: 'fcm_error',
      deliveryId: delivery.id,
      errorCode,
      errorMessage,
    });

    // Check if error indicates invalid registration
    if (INVALID_REGISTRATION_ERRORS.some((code) => errorCode.includes(code))) {
      await this.handleInvalidToken(delivery.id, errorCode, errorMessage);
      return;
    }

    // Check if error is transient
    if (TRANSIENT_FCM_ERRORS.some((code) => errorCode.includes(code))) {
      await this.handleTransientError(delivery, errorCode, errorMessage);
      return;
    }

    // Permanent error
    await this.markDeliveryFailed(delivery.id, errorCode, errorMessage);
  }

  /**
   * Handle invalid token error
   */
  private async handleInvalidToken(deliveryId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Get device token ID
      const delivery = await tx.query.pushDeliveries.findFirst({
        where: eq(pushDeliveries.id, deliveryId),
      });

      if (delivery) {
        // Mark device token as invalid
        await tx
          .update(deviceTokens)
          .set({
            isValid: false,
            invalidatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deviceTokens.id, delivery.deviceTokenId));

        // Mark delivery as invalid_token
        await tx
          .update(pushDeliveries)
          .set({
            status: 'invalid_token',
            errorCode,
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(pushDeliveries.id, deliveryId));

        this.logger.info({
          action: 'token_invalidated',
          deliveryId,
          deviceTokenId: delivery.deviceTokenId,
        });
      }
    });
  }

  /**
   * Handle transient error with retry logic
   */
  private async handleTransientError(
    delivery: { id: string; retryCount: number },
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    const newRetryCount = delivery.retryCount + 1;

    if (newRetryCount >= MAX_RETRY_COUNT) {
      // Max retries reached, mark as failed
      await this.markDeliveryFailed(delivery.id, errorCode, `Max retries reached: ${errorMessage}`);
      return;
    }

    // Calculate exponential backoff: 2^retryCount minutes
    const backoffMinutes = Math.pow(2, newRetryCount);
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await this.db
      .update(pushDeliveries)
      .set({
        retryCount: newRetryCount,
        nextRetryAt,
        errorCode,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(pushDeliveries.id, delivery.id));

    this.logger.info({
      action: 'delivery_retry_scheduled',
      deliveryId: delivery.id,
      retryCount: newRetryCount,
      nextRetryAt,
    });
  }

  /**
   * Mark delivery as permanently failed
   */
  private async markDeliveryFailed(deliveryId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.db
      .update(pushDeliveries)
      .set({
        status: 'failed',
        errorCode,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(pushDeliveries.id, deliveryId));

    this.logger.info({
      action: 'delivery_failed',
      deliveryId,
      errorCode,
    });
  }

  /**
   * Update message statuses to 'completed' when all deliveries are terminal
   */
  private async updateMessageStatuses(): Promise<void> {
    try {
      // Find messages with all deliveries in terminal state
      const messagesToUpdate = await this.db
        .select({
          messageId: pushDeliveries.messageId,
        })
        .from(pushDeliveries)
        .groupBy(pushDeliveries.messageId)
        .having(
          sql`COUNT(*) = COUNT(*) FILTER (WHERE ${pushDeliveries.status} IN ('sent', 'failed', 'invalid_token'))`
        );

      if (messagesToUpdate.length === 0) {
        return;
      }

      const messageIds = messagesToUpdate.map((m) => m.messageId);

      // Update message status to completed
      await this.db
        .update(pushMessages)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(pushMessages.id, messageIds),
            eq(pushMessages.status, 'pending')
          )
        );

      this.logger.info({
        action: 'messages_completed',
        count: messageIds.length,
      });
    } catch (error) {
      this.logger.error({
        action: 'update_message_statuses_error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Signal graceful shutdown
   */
  shutdown(): void {
    this.isShuttingDown = true;
    this.logger.info('Processor shutting down...');
  }
}
