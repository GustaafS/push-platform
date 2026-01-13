#!/usr/bin/env node
/**
 * Development Environment Setup Script
 *
 * This script helps set up environment variables for development mode.
 *
 * Usage:
 *   pnpm --filter api run setup-dev-env
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { initializeApp, deleteApp } from 'firebase-admin/app';

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

async function testFirebaseConnection(projectId: string): Promise<boolean> {
  try {
    const app = initializeApp({
      projectId
    }, 'dev-setup-test');

    console.log('✓ Firebase connection successful\n');

    await deleteApp(app);
    return true;
  } catch (error) {
    console.error('✗ Firebase connection failed:',  error instanceof Error ? error.message : error);
    console.error('  Note: This is expected in development without actual credentials.\n');
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('Push Platform - Development Environment Setup');
  console.log('='.repeat(70) + '\n');

  // Get Firebase Project ID
  const projectId = await question('Enter your Firebase Project ID: ');

  if (!projectId) {
    console.error('Error: Firebase Project ID is required');
    rl.close();
    process.exit(1);
  }

  // Validate project ID format
  const projectIdRegex = /^[a-z0-9-]+$/;
  if (!projectIdRegex.test(projectId)) {
    console.error('Error: Invalid project ID format');
    console.error('Project ID should contain only lowercase letters, numbers, and hyphens');
    rl.close();
    process.exit(1);
  }

  console.log('');

  // Test connection
  console.log('Testing Firebase connection...');
  await testFirebaseConnection(projectId);

  // Determine .env file path (project root)
  const projectRoot = join(process.cwd(), '../..');
  const envPath = join(projectRoot, '.env');
  const envExamplePath = join(projectRoot, '.env.example');

  // Read existing .env or .env.example
  let envContent = '';

  if (existsSync(envPath)) {
    console.log(`Found existing .env file at: ${envPath}`);
    const overwrite = await question('Overwrite existing .env? (y/n): ');

    if (overwrite.toLowerCase() !== 'y') {
      console.log('\nTo manually set the Firebase Project ID, add this to your .env file:');
      console.log(`FIREBASE_PROJECT_ID=${projectId}`);
      rl.close();
      process.exit(0);
    }

    envContent = readFileSync(envPath, 'utf-8');
  } else if (existsSync(envExamplePath)) {
    console.log(`Using .env.example as template: ${envExamplePath}`);
    envContent = readFileSync(envExamplePath, 'utf-8');
  }

  // Update or add FIREBASE_PROJECT_ID
  const lines = envContent.split('\n');
  let found = false;

  const updatedLines = lines.map(line => {
    if (line.startsWith('FIREBASE_PROJECT_ID=') || line.startsWith('#FIREBASE_PROJECT_ID=')) {
      found = true;
      return `FIREBASE_PROJECT_ID=${projectId}`;
    }
    return line;
  });

  if (!found) {
    // Add Firebase configuration section
    updatedLines.push('');
    updatedLines.push('# Firebase Configuration (Development)');
    updatedLines.push(`FIREBASE_PROJECT_ID=${projectId}`);
  }

  // Ensure NODE_ENV is set to development
  const nodeEnvIndex = updatedLines.findIndex(line =>
    line.startsWith('NODE_ENV=') || line.startsWith('#NODE_ENV=')
  );

  if (nodeEnvIndex >= 0) {
    updatedLines[nodeEnvIndex] = 'NODE_ENV=development';
  } else {
    updatedLines.unshift('NODE_ENV=development');
  }

  // Write .env file
  const finalContent = updatedLines.join('\n');
  writeFileSync(envPath, finalContent);

  console.log('');
  console.log('='.repeat(70));
  console.log('✓ Development environment configured successfully!');
  console.log('='.repeat(70) + '\n');

  console.log('Configuration saved to:', envPath);
  console.log('');
  console.log('Environment variables set:');
  console.log(`  NODE_ENV=development`);
  console.log(`  FIREBASE_PROJECT_ID=${projectId}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review and update other variables in .env (DATABASE_URL, API_KEYS, etc.)');
  console.log('  2. Start the database: docker-compose up -d postgres');
  console.log('  3. Run migrations: pnpm migrate');
  console.log('  4. Seed data: pnpm --filter api run seed-data');
  console.log('  5. Start the API: pnpm --filter api dev');
  console.log('  6. Start the worker: pnpm --filter worker dev');
  console.log('');
  console.log('To validate your configuration:');
  console.log('  pnpm --filter api run validate-env');
  console.log('');

  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  rl.close();
  process.exit(1);
});
