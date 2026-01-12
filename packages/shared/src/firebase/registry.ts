import { initializeApp, getApps, getApp, deleteApp, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getEnvOptional } from '../utils/env.js';

export class FirebaseRegistry {
  private static instance: FirebaseRegistry;
  private apps: Map<string, App> = new Map();

  private constructor() {}

  static getInstance(): FirebaseRegistry {
    if (!FirebaseRegistry.instance) {
      FirebaseRegistry.instance = new FirebaseRegistry();
    }
    return FirebaseRegistry.instance;
  }

  /**
   * Get or create Firebase app for a specific application
   */
  async getClient(applicationId: string, firebaseConfig?: Record<string, unknown>): Promise<App> {
    // Return cached app if exists
    if (this.apps.has(applicationId)) {
      return this.apps.get(applicationId)!;
    }

    // Check if running in development mode with project ID only
    const projectId = getEnvOptional('FIREBASE_PROJECT_ID');
    const isDevelopment = process.env.NODE_ENV === 'development';

    let app: App;

    if (isDevelopment && projectId && !firebaseConfig) {
      // Development mode: initialize with project ID only (emulator mode)
      app = initializeApp(
        {
          projectId,
        },
        applicationId
      );
    } else if (firebaseConfig) {
      // Production mode: use service account from database
      app = initializeApp(
        {
          credential: cert(firebaseConfig as any),
        },
        applicationId
      );
    } else {
      // Try to use SERVICE_ACCOUNT_JSON from environment
      const serviceAccountJson = getEnvOptional('SERVICE_ACCOUNT_JSON');
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        app = initializeApp(
          {
            credential: cert(serviceAccount),
          },
          applicationId
        );
      } else {
        throw new Error(
          `Firebase configuration not found for application ${applicationId}. ` +
          'Provide firebaseConfig in database or set FIREBASE_PROJECT_ID (dev) or SERVICE_ACCOUNT_JSON (prod) environment variable.'
        );
      }
    }

    // Cache the app
    this.apps.set(applicationId, app);
    return app;
  }

  /**
   * Get Firebase messaging instance for an application
   */
  async getMessaging(applicationId: string, firebaseConfig?: Record<string, unknown>) {
    const app = await this.getClient(applicationId, firebaseConfig);
    return getMessaging(app);
  }

  /**
   * Clean up all Firebase apps (for graceful shutdown)
   */
  async cleanup(): Promise<void> {
    const deletePromises: Promise<void>[] = [];

    for (const [applicationId, app] of this.apps.entries()) {
      deletePromises.push(
        deleteApp(app).then(() => {
          console.log(`Firebase app deleted for application: ${applicationId}`);
        })
      );
    }

    await Promise.all(deletePromises);
    this.apps.clear();
  }

  /**
   * Delete specific Firebase app
   */
  async deleteClient(applicationId: string): Promise<void> {
    const app = this.apps.get(applicationId);
    if (app) {
      await deleteApp(app);
      this.apps.delete(applicationId);
    }
  }
}
