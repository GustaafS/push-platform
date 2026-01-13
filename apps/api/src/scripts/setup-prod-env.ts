#!/usr/bin/env node
/**
 * Production Environment Setup Script
 *
 * This script helps configure Firebase service account for production.
 *
 * Usage:
 *   pnpm --filter api run setup-prod-env
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function validateServiceAccount(json: string): { valid: boolean; error?: string; projectId?: string } {
  try {
    const serviceAccount = JSON.parse(json);

    // Check required fields
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    for (const field of requiredFields) {
      if (!serviceAccount[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    if (serviceAccount.type !== 'service_account') {
      return { valid: false, error: 'Type field must be "service_account"' };
    }

    return { valid: true, projectId: serviceAccount.project_id };
  } catch (error) {
    return { valid: false, error: 'Invalid JSON format' };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('Push Platform - Production Environment Setup');
  console.log('='.repeat(70) + '\n');

  console.log('This script will help you configure Firebase for production deployment.\n');

  // Get service account file path
  const filePath = await question('Enter path to firebase-credentials.json: ');

  if (!filePath) {
    console.error('Error: File path is required');
    rl.close();
    process.exit(1);
  }

  // Read and validate service account
  let serviceAccountJson: string;
  try {
    serviceAccountJson = readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Error reading file:', error instanceof Error ? error.message : error);
    rl.close();
    process.exit(1);
  }

  const validation = validateServiceAccount(serviceAccountJson);

  if (!validation.valid) {
    console.error('✗ Invalid service account:', validation.error);
    console.error('\nPlease ensure the file is a valid Firebase service account JSON.');
    rl.close();
    process.exit(1);
  }

  console.log(`✓ Service account validated successfully`);
  console.log(`  Project ID: ${validation.projectId}\n`);

  // Choose configuration method
  console.log('How would you like to configure the service account?\n');
  console.log('1. Base64 encode to SERVICE_ACCOUNT_JSON (recommended for Docker/Kubernetes)');
  console.log('2. Use file path with FIREBASE_CREDENTIALS_PATH (for traditional servers)');
  console.log('');

  const choice = await question('Enter choice (1 or 2): ');

  console.log('');

  if (choice === '1') {
    // Base64 encoding
    const base64 = Buffer.from(serviceAccountJson, 'utf-8').toString('base64');

    console.log('='.repeat(70));
    console.log('Base64 Encoded Service Account');
    console.log('='.repeat(70) + '\n');

    console.log('Copy the following and set as SERVICE_ACCOUNT_JSON environment variable:\n');
    console.log(base64);
    console.log('');

    console.log('='.repeat(70));
    console.log('Deployment Examples');
    console.log('='.repeat(70) + '\n');

    console.log('Docker Compose (docker-compose.yml):');
    console.log('  environment:');
    console.log(`    - SERVICE_ACCOUNT_JSON=${base64.substring(0, 50)}...`);
    console.log('');

    console.log('Kubernetes Secret:');
    console.log('  kubectl create secret generic firebase-credentials \\');
    console.log(`    --from-literal=service-account-json="${base64.substring(0, 50)}..."`);
    console.log('');

    console.log('Bash Export:');
    console.log(`  export SERVICE_ACCOUNT_JSON="${base64}"`);
    console.log('');

  } else if (choice === '2') {
    // File path approach
    console.log('='.repeat(70));
    console.log('File Path Configuration');
    console.log('='.repeat(70) + '\n');

    console.log('Set the following environment variable:\n');
    console.log(`  FIREBASE_CREDENTIALS_PATH=${filePath}`);
    console.log('');

    console.log('Ensure the file is accessible by the application:');
    console.log('  - Readable by application user');
    console.log('  - Secure permissions (600 or 400)');
    console.log('  - Not in version control');
    console.log('');

    console.log('For Docker, mount as volume:');
    console.log('  volumes:');
    console.log(`    - ${filePath}:/app/credentials/firebase-credentials.json:ro`);
    console.log('  environment:');
    console.log('    - FIREBASE_CREDENTIALS_PATH=/app/credentials/firebase-credentials.json');
    console.log('');

  } else {
    console.error('Invalid choice');
    rl.close();
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('⚠️  SECURITY REMINDERS');
  console.log('='.repeat(70));
  console.log('- Never commit service account credentials to version control');
  console.log('- Use secret management systems in production (AWS Secrets Manager, etc.)');
  console.log('- Rotate credentials every 90 days');
  console.log('- Limit access to essential personnel only');
  console.log('- Set NODE_ENV=production in your deployment environment');
  console.log('='.repeat(70) + '\n');

  console.log('Next steps:');
  console.log('  1. Set the environment variable in your deployment platform');
  console.log('  2. Set NODE_ENV=production');
  console.log('  3. Configure other required variables (DATABASE_URL, API_KEYS)');
  console.log('  4. Validate configuration: pnpm --filter api run validate-env');
  console.log('  5. Deploy your application');
  console.log('');

  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  rl.close();
  process.exit(1);
});
