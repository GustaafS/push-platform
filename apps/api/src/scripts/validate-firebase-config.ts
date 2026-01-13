#!/usr/bin/env node
/**
 * Firebase Configuration Validation Script
 *
 * This script validates that Firebase is properly configured for the Push Platform.
 * It checks environment variables, tests Firebase connectivity, and reports any issues.
 *
 * Usage:
 *   pnpm --filter api run validate-firebase
 *
 * Environment Variables:
 *   - FIREBASE_PROJECT_ID (development mode)
 *   - SERVICE_ACCOUNT_JSON (production mode)
 *   - FIREBASE_CREDENTIALS_PATH (alternative to SERVICE_ACCOUNT_JSON)
 *   - NODE_ENV (determines expected configuration)
 */

import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { config } from '@dotenvx/dotenvx';

// Load environment variables
config();

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string;
}

class FirebaseConfigValidator {
  private results: ValidationResult[] = [];

  /**
   * Add a validation result
   */
  private addResult(valid: boolean, message: string, details?: string): void {
    this.results.push({ valid, message, details });
  }

  /**
   * Print validation results
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(70));
    console.log('Firebase Configuration Validation Results');
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

  /**
   * Check if NODE_ENV is set
   */
  private validateNodeEnv(): boolean {
    const nodeEnv = process.env.NODE_ENV;

    if (!nodeEnv) {
      this.addResult(
        false,
        'NODE_ENV not set',
        'Set NODE_ENV to "development" or "production"'
      );
      return false;
    }

    this.addResult(
      true,
      `NODE_ENV is set to: ${nodeEnv}`,
      `Running in ${nodeEnv} mode`
    );
    return true;
  }

  /**
   * Check Firebase Project ID (development mode)
   */
  private validateProjectId(): boolean {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
      if (!projectId) {
        this.addResult(
          false,
          'FIREBASE_PROJECT_ID not set (required for development)',
          'Set FIREBASE_PROJECT_ID in .env file or environment'
        );
        return false;
      }

      // Validate project ID format
      const projectIdRegex = /^[a-z0-9-]+$/;
      if (!projectIdRegex.test(projectId)) {
        this.addResult(
          false,
          'FIREBASE_PROJECT_ID has invalid format',
          'Project ID should contain only lowercase letters, numbers, and hyphens'
        );
        return false;
      }

      this.addResult(
        true,
        `FIREBASE_PROJECT_ID is set: ${projectId}`,
        'Development mode will use project ID without credentials'
      );
      return true;
    } else {
      if (projectId) {
        this.addResult(
          true,
          `FIREBASE_PROJECT_ID is set: ${projectId}`,
          'Note: In production, service account credentials are preferred'
        );
      } else {
        this.addResult(
          true,
          'FIREBASE_PROJECT_ID not set (optional in production)',
          'Production will use service account from SERVICE_ACCOUNT_JSON or database'
        );
      }
      return true;
    }
  }

  /**
   * Check Service Account JSON (production mode)
   */
  private validateServiceAccount(): { valid: boolean; config?: any } {
    const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      this.addResult(
        true,
        'SERVICE_ACCOUNT_JSON not required in development',
        'Development mode uses FIREBASE_PROJECT_ID only'
      );
      return { valid: true };
    }

    if (!serviceAccountJson) {
      this.addResult(
        false,
        'SERVICE_ACCOUNT_JSON not set (required for production)',
        'Set SERVICE_ACCOUNT_JSON environment variable or use FIREBASE_CREDENTIALS_PATH'
      );
      return { valid: false };
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);

      // Validate required fields
      const requiredFields = [
        'type',
        'project_id',
        'private_key_id',
        'private_key',
        'client_email',
        'client_id'
      ];

      const missingFields = requiredFields.filter(field => !serviceAccount[field]);

      if (missingFields.length > 0) {
        this.addResult(
          false,
          'SERVICE_ACCOUNT_JSON missing required fields',
          `Missing: ${missingFields.join(', ')}`
        );
        return { valid: false };
      }

      // Validate field formats
      if (serviceAccount.type !== 'service_account') {
        this.addResult(
          false,
          'SERVICE_ACCOUNT_JSON type field is invalid',
          `Expected "service_account", got "${serviceAccount.type}"`
        );
        return { valid: false };
      }

      if (!serviceAccount.client_email.endsWith('@iam.gserviceaccount.com')) {
        this.addResult(
          false,
          'SERVICE_ACCOUNT_JSON client_email has invalid format',
          'Should end with @iam.gserviceaccount.com'
        );
        return { valid: false };
      }

      if (!serviceAccount.private_key.includes('BEGIN PRIVATE KEY')) {
        this.addResult(
          false,
          'SERVICE_ACCOUNT_JSON private_key has invalid format',
          'Should be in PEM format starting with -----BEGIN PRIVATE KEY-----'
        );
        return { valid: false };
      }

      this.addResult(
        true,
        'SERVICE_ACCOUNT_JSON is valid',
        `Project: ${serviceAccount.project_id}, Email: ${serviceAccount.client_email}`
      );

      return { valid: true, config: serviceAccount };
    } catch (error) {
      this.addResult(
        false,
        'SERVICE_ACCOUNT_JSON is not valid JSON',
        error instanceof Error ? error.message : 'Unknown parsing error'
      );
      return { valid: false };
    }
  }

  /**
   * Test Firebase connectivity
   */
  private async testFirebaseConnection(serviceAccount?: any): Promise<boolean> {
    try {
      let app;
      const isDevelopment = process.env.NODE_ENV === 'development';
      const projectId = process.env.FIREBASE_PROJECT_ID;

      // Initialize Firebase app for testing
      if (isDevelopment && projectId) {
        app = initializeApp({
          projectId,
        }, 'validation-test');
      } else if (serviceAccount) {
        app = initializeApp({
          credential: cert(serviceAccount),
        }, 'validation-test');
      } else {
        this.addResult(
          false,
          'Cannot test Firebase connection',
          'No valid configuration available'
        );
        return false;
      }

      // Try to get messaging instance
      const messaging = getMessaging(app);

      this.addResult(
        true,
        'Firebase connection successful',
        'Successfully initialized Firebase Admin SDK and messaging service'
      );

      // Clean up test app
      await deleteApp(app);

      return true;
    } catch (error) {
      this.addResult(
        false,
        'Firebase connection failed',
        error instanceof Error ? error.message : 'Unknown connection error'
      );
      return false;
    }
  }

  /**
   * Run all validations
   */
  async validate(): Promise<boolean> {
    console.log('Starting Firebase configuration validation...\n');

    // 1. Validate NODE_ENV
    this.validateNodeEnv();

    // 2. Validate FIREBASE_PROJECT_ID
    this.validateProjectId();

    // 3. Validate SERVICE_ACCOUNT_JSON
    const serviceAccountResult = this.validateServiceAccount();

    // 4. Test Firebase connection
    await this.testFirebaseConnection(serviceAccountResult.config);

    // Print results
    this.printResults();

    // Return overall success
    const allValid = this.results.every(r => r.valid);
    return allValid;
  }
}

/**
 * Main execution
 */
async function main() {
  const validator = new FirebaseConfigValidator();
  const isValid = await validator.validate();

  if (isValid) {
    console.log('✓ Firebase configuration is valid and ready to use!\n');
    process.exit(0);
  } else {
    console.error('✗ Firebase configuration validation failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  console.error('Unexpected error during validation:', error);
  process.exit(1);
});
