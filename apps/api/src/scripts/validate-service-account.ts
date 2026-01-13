#!/usr/bin/env node
/**
 * Service Account JSON Validation Script
 *
 * This script validates Firebase service account JSON structure and tests authentication.
 *
 * Usage:
 *   pnpm --filter api run validate-service-account /path/to/firebase-credentials.json
 *   pnpm --filter api run validate-service-account  # Will prompt for path
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string;
}

interface ServiceAccount {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

class ServiceAccountValidator {
  private results: ValidationResult[] = [];
  private serviceAccount?: ServiceAccount;

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
    console.log('Service Account Validation Results');
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
   * Load and parse service account JSON
   */
  loadServiceAccount(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf-8');
      this.serviceAccount = JSON.parse(content);

      this.addResult(
        true,
        'Service account JSON loaded successfully',
        `File: ${filePath}`
      );
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if ('code' in error && error.code === 'ENOENT') {
          this.addResult(
            false,
            'Service account file not found',
            `File does not exist: ${filePath}`
          );
        } else if (error instanceof SyntaxError) {
          this.addResult(
            false,
            'Service account JSON is malformed',
            error.message
          );
        } else {
          this.addResult(
            false,
            'Error loading service account',
            error.message
          );
        }
      }
      return false;
    }
  }

  /**
   * Validate required fields exist
   */
  validateRequiredFields(): boolean {
    if (!this.serviceAccount) {
      return false;
    }

    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id'
    ];

    const missingFields = requiredFields.filter(
      field => !this.serviceAccount![field as keyof ServiceAccount]
    );

    if (missingFields.length > 0) {
      this.addResult(
        false,
        'Missing required fields',
        `Missing: ${missingFields.join(', ')}`
      );
      return false;
    }

    this.addResult(
      true,
      'All required fields present',
      `Validated: ${requiredFields.join(', ')}`
    );
    return true;
  }

  /**
   * Validate type field
   */
  validateType(): boolean {
    if (!this.serviceAccount?.type) {
      return false;
    }

    if (this.serviceAccount.type !== 'service_account') {
      this.addResult(
        false,
        'Invalid type field',
        `Expected "service_account", got "${this.serviceAccount.type}"`
      );
      return false;
    }

    this.addResult(
      true,
      'Type field is correct',
      'Type: service_account'
    );
    return true;
  }

  /**
   * Validate project ID format
   */
  validateProjectId(): boolean {
    if (!this.serviceAccount?.project_id) {
      return false;
    }

    const projectId = this.serviceAccount.project_id;

    // Project ID should contain only lowercase letters, numbers, and hyphens
    const projectIdRegex = /^[a-z0-9-]+$/;

    if (!projectIdRegex.test(projectId)) {
      this.addResult(
        false,
        'Invalid project ID format',
        'Project ID should contain only lowercase letters, numbers, and hyphens'
      );
      return false;
    }

    this.addResult(
      true,
      `Project ID is valid: ${projectId}`,
      'Format matches Firebase requirements'
    );
    return true;
  }

  /**
   * Validate private key format
   */
  validatePrivateKey(): boolean {
    if (!this.serviceAccount?.private_key) {
      return false;
    }

    const privateKey = this.serviceAccount.private_key;

    // Check PEM format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      this.addResult(
        false,
        'Private key missing PEM header',
        'Should start with -----BEGIN PRIVATE KEY-----'
      );
      return false;
    }

    if (!privateKey.includes('-----END PRIVATE KEY-----')) {
      this.addResult(
        false,
        'Private key missing PEM footer',
        'Should end with -----END PRIVATE KEY-----'
      );
      return false;
    }

    // Check if key has content between headers
    const keyContent = privateKey
      .split('-----BEGIN PRIVATE KEY-----')[1]
      ?.split('-----END PRIVATE KEY-----')[0]
      ?.trim();

    if (!keyContent || keyContent.length < 50) {
      this.addResult(
        false,
        'Private key appears to be empty or too short',
        'Key content is missing or incomplete'
      );
      return false;
    }

    this.addResult(
      true,
      'Private key format is valid',
      'PEM format with valid content'
    );
    return true;
  }

  /**
   * Validate client email format
   */
  validateClientEmail(): boolean {
    if (!this.serviceAccount?.client_email) {
      return false;
    }

    const clientEmail = this.serviceAccount.client_email;

    // Should end with @*.iam.gserviceaccount.com
    if (!clientEmail.endsWith('.iam.gserviceaccount.com')) {
      this.addResult(
        false,
        'Invalid client email format',
        'Should end with .iam.gserviceaccount.com'
      );
      return false;
    }

    // Should be a valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      this.addResult(
        false,
        'Client email has invalid email format',
        clientEmail
      );
      return false;
    }

    this.addResult(
      true,
      'Client email format is valid',
      clientEmail
    );
    return true;
  }

  /**
   * Test Firebase authentication
   */
  async testAuthentication(): Promise<boolean> {
    if (!this.serviceAccount) {
      return false;
    }

    try {
      // Initialize Firebase app with service account
      const app = initializeApp({
        credential: cert(this.serviceAccount as any)
      }, 'validation-test-sa');

      // Try to get messaging instance
      const messaging = getMessaging(app);

      this.addResult(
        true,
        'Firebase authentication successful',
        'Successfully initialized Firebase Admin SDK with service account'
      );

      // Clean up
      await deleteApp(app);

      return true;
    } catch (error) {
      this.addResult(
        false,
        'Firebase authentication failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  /**
   * Run all validations
   */
  async validate(filePath: string): Promise<boolean> {
    console.log('Starting service account validation...\n');

    // 1. Load JSON file
    const loaded = this.loadServiceAccount(filePath);
    if (!loaded) {
      this.printResults();
      return false;
    }

    // 2. Validate required fields
    this.validateRequiredFields();

    // 3. Validate type field
    this.validateType();

    // 4. Validate project ID
    this.validateProjectId();

    // 5. Validate private key
    this.validatePrivateKey();

    // 6. Validate client email
    this.validateClientEmail();

    // 7. Test authentication
    await this.testAuthentication();

    // Print results
    this.printResults();

    // Return overall success
    return this.results.every(r => r.valid);
  }
}

/**
 * Prompt user for file path
 */
async function promptForPath(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter path to firebase-credentials.json: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('Firebase Service Account Validator\n');

  let filePath = process.argv[2];

  if (!filePath) {
    filePath = await promptForPath();
  }

  if (!filePath) {
    console.error('Error: No file path provided');
    process.exit(1);
  }

  const validator = new ServiceAccountValidator();
  const isValid = await validator.validate(filePath);

  if (isValid) {
    console.log('✓ Service account is valid and ready to use!\n');
    console.log('Next steps:');
    console.log('1. Set SERVICE_ACCOUNT_JSON environment variable (use json-to-base64 script)');
    console.log('2. OR set FIREBASE_CREDENTIALS_PATH to file location');
    console.log('3. Test with: pnpm --filter api run validate-env\n');
    process.exit(0);
  } else {
    console.error('✗ Service account validation failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  console.error('Unexpected error during validation:', error);
  process.exit(1);
});
