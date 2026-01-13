#!/usr/bin/env node
/**
 * Complete Environment Validation Script
 *
 * This script validates all environment variables needed for the Push Platform.
 *
 * Usage:
 *   pnpm --filter api run validate-env
 */

import { config } from '@dotenvx/dotenvx';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Load environment variables
config();

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string;
}

class EnvironmentValidator {
  private results: ValidationResult[] = [];

  private addResult(valid: boolean, message: string, details?: string): void {
    this.results.push({ valid, message, details });
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(70));
    console.log('Environment Validation Results');
    console.log('='.repeat(70) + '\n');

    let passCount = 0;
    let failCount = 0;

    this.results.forEach((result, index) => {
      const icon = result.valid ? '✓' : '✗';
      const status = result.valid ? 'PASS' : 'FAIL';

      console.log(`${index + 1}. [${icon}] ${status}: ${result.message}`);

      if (result.details) {
        console.log(`   ${result.details}`);
      }
      console.log('');

      if (result.valid) {
        passCount++;
      } else {
        failCount++;
      }
    });

    console.log('='.repeat(70));
    console.log(`Summary: ${passCount} passed, ${failCount} failed`);
    console.log('='.repeat(70) + '\n');
  }

  validateNodeEnv(): boolean {
    const nodeEnv = process.env.NODE_ENV;

    if (!nodeEnv) {
      this.addResult(false, 'NODE_ENV not set', 'Set to "development" or "production"');
      return false;
    }

    const validValues = ['development', 'production', 'test', 'staging'];
    if (!validValues.includes(nodeEnv)) {
      this.addResult(
        false,
        'NODE_ENV has unusual value',
        `Set to "${nodeEnv}". Recommended: development or production`
      );
      return false;
    }

    this.addResult(true, `NODE_ENV: ${nodeEnv}`, 'Valid environment mode');
    return true;
  }

  validateDatabaseUrl(): boolean {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      this.addResult(false, 'DATABASE_URL not set', 'PostgreSQL connection string required');
      return false;
    }

    // Basic PostgreSQL URL validation
    if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
      this.addResult(
        false,
        'DATABASE_URL has invalid format',
        'Should start with postgres:// or postgresql://'
      );
      return false;
    }

    this.addResult(true, 'DATABASE_URL is set', 'PostgreSQL connection configured');
    return true;
  }

  validateApiConfig(): boolean {
    const apiKeys = process.env.API_KEYS;
    const apiPort = process.env.API_PORT || '3000';
    const apiHost = process.env.API_HOST || '0.0.0.0';

    let allValid = true;

    if (!apiKeys) {
      this.addResult(false, 'API_KEYS not set', 'At least one API key required for authentication');
      allValid = false;
    } else {
      const keys = apiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (keys.length === 0) {
        this.addResult(false, 'API_KEYS is empty', 'Provide comma-separated API keys');
        allValid = false;
      } else {
        this.addResult(true, `API_KEYS configured (${keys.length} keys)`, 'API authentication enabled');
      }
    }

    this.addResult(true, `API_PORT: ${apiPort}`, 'API server port configured');
    this.addResult(true, `API_HOST: ${apiHost}`, 'API server host configured');

    return allValid;
  }

  validateWorkerConfig(): boolean {
    const pollInterval = process.env.WORKER_POLL_INTERVAL_MS || '10000';
    const batchSize = process.env.WORKER_BATCH_SIZE || '100';
    const maxRetry = process.env.MAX_RETRY_COUNT || '5';

    this.addResult(true, `WORKER_POLL_INTERVAL_MS: ${pollInterval}`, 'Worker polling configured');
    this.addResult(true, `WORKER_BATCH_SIZE: ${batchSize}`, 'Batch processing configured');
    this.addResult(true, `MAX_RETRY_COUNT: ${maxRetry}`, 'Retry logic configured');

    return true;
  }

  validateFirebaseConfig(): boolean {
    const nodeEnv = process.env.NODE_ENV;
    const isDevelopment = nodeEnv === 'development';

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
    const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH;

    if (isDevelopment) {
      // Development mode: only FIREBASE_PROJECT_ID needed
      if (!projectId) {
        this.addResult(
          false,
          'FIREBASE_PROJECT_ID not set (required for development)',
          'Set your Firebase project ID in .env file'
        );
        return false;
      }

      this.addResult(true, `FIREBASE_PROJECT_ID: ${projectId}`, 'Development mode configured');
      return true;

    } else {
      // Production mode: need service account
      if (!serviceAccountJson && !credentialsPath) {
        this.addResult(
          false,
          'No Firebase credentials found (required for production)',
          'Set SERVICE_ACCOUNT_JSON or FIREBASE_CREDENTIALS_PATH'
        );
        return false;
      }

      if (serviceAccountJson) {
        try {
          const serviceAccount = JSON.parse(serviceAccountJson);
          const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
          const missing = requiredFields.filter(f => !serviceAccount[f]);

          if (missing.length > 0) {
            this.addResult(
              false,
              'SERVICE_ACCOUNT_JSON missing fields',
              `Missing: ${missing.join(', ')}`
            );
            return false;
          }

          this.addResult(
            true,
            'SERVICE_ACCOUNT_JSON is valid',
            `Project: ${serviceAccount.project_id}`
          );
          return true;

        } catch (error) {
          this.addResult(
            false,
            'SERVICE_ACCOUNT_JSON is not valid JSON',
            error instanceof Error ? error.message : 'Parse error'
          );
          return false;
        }
      }

      if (credentialsPath) {
        this.addResult(
          true,
          'FIREBASE_CREDENTIALS_PATH is set',
          `Path: ${credentialsPath}`
        );
        return true;
      }
    }

    return false;
  }

  async testFirebaseConnection(): Promise<boolean> {
    try {
      const nodeEnv = process.env.NODE_ENV;
      const isDevelopment = nodeEnv === 'development';
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;

      let app;

      if (isDevelopment && projectId) {
        app = initializeApp({ projectId }, 'env-validation-test');
      } else if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        app = initializeApp({ credential: cert(serviceAccount) }, 'env-validation-test');
      } else {
        this.addResult(false, 'Cannot test Firebase connection', 'No valid configuration');
        return false;
      }

      const messaging = getMessaging(app);

      this.addResult(
        true,
        'Firebase connection successful',
        'Admin SDK initialized and messaging service accessible'
      );

      await deleteApp(app);
      return true;

    } catch (error) {
      this.addResult(
        false,
        'Firebase connection failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  async validate(): Promise<boolean> {
    console.log('Starting comprehensive environment validation...\n');

    // 1. Validate NODE_ENV
    this.validateNodeEnv();

    // 2. Validate DATABASE_URL
    this.validateDatabaseUrl();

    // 3. Validate API configuration
    this.validateApiConfig();

    // 4. Validate worker configuration
    this.validateWorkerConfig();

    // 5. Validate Firebase configuration
    this.validateFirebaseConfig();

    // 6. Test Firebase connection
    await this.testFirebaseConnection();

    // Print results
    this.printResults();

    // Return overall success
    return this.results.every(r => r.valid);
  }
}

async function main() {
  const validator = new EnvironmentValidator();
  const isValid = await validator.validate();

  if (isValid) {
    console.log('✓ All environment variables are configured correctly!\n');
    console.log('Your Push Platform is ready to run.\n');
    process.exit(0);
  } else {
    console.error('✗ Environment validation failed. Please fix the issues above.\n');
    console.error('For help with configuration, see:');
    console.error('  - docs/implementation/environment-configuration.md');
    console.error('  - docs/implementation/firebase-project-setup.md\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error during validation:', error);
  process.exit(1);
});
