#!/usr/bin/env node
/**
 * JSON to Base64 Converter for Service Account
 *
 * This script converts Firebase service account JSON to base64 string
 * for use in SERVICE_ACCOUNT_JSON environment variable.
 *
 * Usage:
 *   pnpm --filter api run json-to-base64 /path/to/firebase-credentials.json
 *   pnpm --filter api run json-to-base64  # Will prompt for path
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';

/**
 * Convert JSON file to base64
 */
function jsonToBase64(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8');

    // Validate JSON
    JSON.parse(content);

    // Convert to base64
    const base64 = Buffer.from(content, 'utf-8').toString('base64');

    return base64;
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON: ${error.message}`);
      } else {
        throw new Error(`Error reading file: ${error.message}`);
      }
    }
    throw error;
  }
}

/**
 * Decode base64 back to JSON (for verification)
 */
function base64ToJson(base64: string): string {
  try {
    const json = Buffer.from(base64, 'base64').toString('utf-8');

    // Validate JSON
    JSON.parse(json);

    return json;
  } catch (error) {
    throw new Error('Invalid base64 or JSON format');
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
 * Print environment variable setup instructions
 */
function printInstructions(base64: string, filePath: string): void {
  console.log('\n' + '='.repeat(70));
  console.log('Base64 Encoded Service Account');
  console.log('='.repeat(70) + '\n');

  console.log('Source file:', filePath);
  console.log('Encoded length:', base64.length, 'characters\n');

  console.log('Set as environment variable:\n');

  // Bash/Linux
  console.log('# Bash/Linux (bash, zsh, etc.)');
  console.log(`export SERVICE_ACCOUNT_JSON="${base64}"`);
  console.log('');

  // Docker
  console.log('# Docker (docker-compose.yml)');
  console.log('environment:');
  console.log(`  - SERVICE_ACCOUNT_JSON=${base64}`);
  console.log('');

  // Kubernetes
  console.log('# Kubernetes (create secret first, then reference)');
  console.log('# Step 1: Create secret');
  console.log(`kubectl create secret generic firebase-credentials --from-literal=service-account-json="${base64}"`);
  console.log('');
  console.log('# Step 2: Reference in deployment.yaml');
  console.log('env:');
  console.log('  - name: SERVICE_ACCOUNT_JSON');
  console.log('    valueFrom:');
  console.log('      secretKeyRef:');
  console.log('        name: firebase-credentials');
  console.log('        key: service-account-json');
  console.log('');

  // .env file (with warning)
  console.log('# .env file (DEVELOPMENT ONLY - never commit)');
  console.log(`SERVICE_ACCOUNT_JSON=${base64}`);
  console.log('');

  console.log('='.repeat(70));
  console.log('⚠️  SECURITY WARNING');
  console.log('='.repeat(70));
  console.log('- Never commit this value to version control');
  console.log('- Use secret management systems in production');
  console.log('- Rotate credentials every 90 days');
  console.log('- Limit access to essential personnel only');
  console.log('='.repeat(70) + '\n');
}

/**
 * Verify encoding/decoding works correctly
 */
function verifyEncoding(base64: string): boolean {
  try {
    const decoded = base64ToJson(base64);
    const serviceAccount = JSON.parse(decoded);

    // Check required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      console.error('✗ Verification failed: Missing required fields');
      return false;
    }

    console.log('✓ Encoding verified successfully');
    console.log(`  Project ID: ${serviceAccount.project_id}`);
    console.log(`  Client Email: ${serviceAccount.client_email}`);
    console.log('');

    return true;
  } catch (error) {
    console.error('✗ Verification failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Firebase Service Account JSON to Base64 Converter\n');

  let filePath = process.argv[2];

  if (!filePath) {
    filePath = await promptForPath();
  }

  if (!filePath) {
    console.error('Error: No file path provided');
    process.exit(1);
  }

  try {
    // Convert to base64
    console.log(`Converting: ${filePath}\n`);
    const base64 = jsonToBase64(filePath);

    // Verify encoding
    const verified = verifyEncoding(base64);
    if (!verified) {
      process.exit(1);
    }

    // Print instructions
    printInstructions(base64, filePath);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run script
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
