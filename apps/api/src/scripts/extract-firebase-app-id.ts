#!/usr/bin/env node
/**
 * Extract Firebase App ID from GoogleService-Info.plist
 *
 * This script parses a GoogleService-Info.plist file and extracts
 * important Firebase configuration values.
 *
 * Usage:
 *   pnpm --filter api run extract-app-id /path/to/GoogleService-Info.plist
 *   pnpm --filter api run extract-app-id  # Will prompt for path
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';

interface PlistConfig {
  GOOGLE_APP_ID?: string;
  BUNDLE_ID?: string;
  PROJECT_ID?: string;
  GCM_SENDER_ID?: string;
  API_KEY?: string;
  STORAGE_BUCKET?: string;
  DATABASE_URL?: string;
}

/**
 * Simple plist parser for extracting key-value pairs
 * Handles basic plist format with string keys and values
 */
function parsePlist(content: string): PlistConfig {
  const config: PlistConfig = {};
  const lines = content.split('\n');

  let currentKey: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Extract key
    const keyMatch = trimmedLine.match(/<key>(.*?)<\/key>/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      continue;
    }

    // Extract string value for the current key
    const stringMatch = trimmedLine.match(/<string>(.*?)<\/string>/);
    if (stringMatch && currentKey) {
      const value = stringMatch[1];

      // Store relevant configuration keys
      if (currentKey === 'GOOGLE_APP_ID' ||
          currentKey === 'BUNDLE_ID' ||
          currentKey === 'PROJECT_ID' ||
          currentKey === 'GCM_SENDER_ID' ||
          currentKey === 'API_KEY' ||
          currentKey === 'STORAGE_BUCKET' ||
          currentKey === 'DATABASE_URL') {
        config[currentKey] = value;
      }

      currentKey = null;
    }
  }

  return config;
}

/**
 * Validate that required fields are present
 */
function validateConfig(config: PlistConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.GOOGLE_APP_ID) {
    errors.push('Missing required field: GOOGLE_APP_ID');
  }

  if (!config.BUNDLE_ID) {
    errors.push('Missing required field: BUNDLE_ID');
  }

  if (!config.PROJECT_ID) {
    errors.push('Missing required field: PROJECT_ID');
  }

  if (!config.GCM_SENDER_ID) {
    errors.push('Missing required field: GCM_SENDER_ID');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Print configuration in a formatted way
 */
function printConfig(config: PlistConfig): void {
  console.log('\n' + '='.repeat(70));
  console.log('Firebase App Configuration');
  console.log('='.repeat(70) + '\n');

  if (config.GOOGLE_APP_ID) {
    console.log(`Firebase App ID:    ${config.GOOGLE_APP_ID}`);
  }

  if (config.BUNDLE_ID) {
    console.log(`Bundle ID:          ${config.BUNDLE_ID}`);
  }

  if (config.PROJECT_ID) {
    console.log(`Project ID:         ${config.PROJECT_ID}`);
  }

  if (config.GCM_SENDER_ID) {
    console.log(`GCM Sender ID:      ${config.GCM_SENDER_ID}`);
  }

  if (config.API_KEY) {
    console.log(`API Key:            ${config.API_KEY.substring(0, 20)}...`);
  }

  if (config.STORAGE_BUCKET) {
    console.log(`Storage Bucket:     ${config.STORAGE_BUCKET}`);
  }

  if (config.DATABASE_URL) {
    console.log(`Database URL:       ${config.DATABASE_URL}`);
  }

  console.log('\n' + '='.repeat(70) + '\n');
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
    rl.question('Enter path to GoogleService-Info.plist: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('Extract Firebase App ID from GoogleService-Info.plist\n');

  // Get file path from command line or prompt
  let filePath = process.argv[2];

  if (!filePath) {
    filePath = await promptForPath();
  }

  if (!filePath) {
    console.error('Error: No file path provided');
    process.exit(1);
  }

  try {
    // Read plist file
    console.log(`Reading file: ${filePath}\n`);
    const content = readFileSync(filePath, 'utf-8');

    // Parse plist
    const config = parsePlist(content);

    // Validate configuration
    const validation = validateConfig(config);

    if (!validation.valid) {
      console.error('Validation Errors:');
      validation.errors.forEach(error => {
        console.error(`  - ${error}`);
      });
      console.error('\nThe plist file may be corrupted or incomplete.');
      process.exit(1);
    }

    // Print configuration
    printConfig(config);

    // Print usage notes
    console.log('Usage Notes:');
    console.log('  - Add GoogleService-Info.plist to your iOS project in Xcode');
    console.log('  - Ensure it\'s included in your app target');
    console.log('  - DO NOT commit this file to version control');
    console.log('  - The PROJECT_ID above should match FIREBASE_PROJECT_ID in .env\n');

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        console.error(`Error: File not found: ${filePath}`);
        console.error('Please check the file path and try again.');
      } else {
        console.error('Error reading or parsing plist file:', error.message);
      }
    } else {
      console.error('Unknown error:', error);
    }
    process.exit(1);
  }
}

// Run script
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
