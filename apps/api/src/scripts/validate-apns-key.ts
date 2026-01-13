#!/usr/bin/env node
/**
 * APNs Key Validation Script
 *
 * This script validates APNs authentication key format before uploading to Firebase.
 * It checks the Key ID, Team ID format, and .p8 file structure.
 *
 * Usage:
 *   pnpm --filter api run validate-apns /path/to/AuthKey_ABC1234DEF.p8
 *   pnpm --filter api run validate-apns  # Will prompt for inputs
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string;
}

class APNsKeyValidator {
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
    console.log('APNs Key Validation Results');
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
   * Validate Key ID format
   */
  validateKeyId(keyId: string): boolean {
    // Key ID should be exactly 10 alphanumeric characters
    const keyIdRegex = /^[A-Z0-9]{10}$/;

    if (!keyId) {
      this.addResult(
        false,
        'Key ID is empty',
        'Key ID must be provided (10-character identifier from Apple Developer Portal)'
      );
      return false;
    }

    if (keyId.length !== 10) {
      this.addResult(
        false,
        'Key ID has incorrect length',
        `Expected 10 characters, got ${keyId.length}. Example: ABC1234DEF`
      );
      return false;
    }

    if (!keyIdRegex.test(keyId)) {
      this.addResult(
        false,
        'Key ID has invalid format',
        'Key ID must be exactly 10 uppercase alphanumeric characters (A-Z, 0-9)'
      );
      return false;
    }

    this.addResult(
      true,
      `Key ID is valid: ${keyId}`,
      '10-character format matches Apple Developer Portal requirements'
    );
    return true;
  }

  /**
   * Validate Team ID format
   */
  validateTeamId(teamId: string): boolean {
    // Team ID should be exactly 10 alphanumeric characters
    const teamIdRegex = /^[A-Z0-9]{10}$/;

    if (!teamId) {
      this.addResult(
        false,
        'Team ID is empty',
        'Team ID must be provided (10-character identifier from Apple Developer Portal)'
      );
      return false;
    }

    if (teamId.length !== 10) {
      this.addResult(
        false,
        'Team ID has incorrect length',
        `Expected 10 characters, got ${teamId.length}. Example: XYZ9876ABC`
      );
      return false;
    }

    if (!teamIdRegex.test(teamId)) {
      this.addResult(
        false,
        'Team ID has invalid format',
        'Team ID must be exactly 10 uppercase alphanumeric characters (A-Z, 0-9)'
      );
      return false;
    }

    this.addResult(
      true,
      `Team ID is valid: ${teamId}`,
      '10-character format matches Apple Developer Portal requirements'
    );
    return true;
  }

  /**
   * Validate .p8 file format
   */
  validateP8File(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf-8');

      // Check if file is empty
      if (!content || content.trim().length === 0) {
        this.addResult(
          false,
          '.p8 file is empty',
          'The file contains no content'
        );
        return false;
      }

      // Check for PEM format header
      if (!content.includes('-----BEGIN PRIVATE KEY-----')) {
        this.addResult(
          false,
          '.p8 file missing PEM header',
          'File should start with -----BEGIN PRIVATE KEY-----'
        );
        return false;
      }

      // Check for PEM format footer
      if (!content.includes('-----END PRIVATE KEY-----')) {
        this.addResult(
          false,
          '.p8 file missing PEM footer',
          'File should end with -----END PRIVATE KEY-----'
        );
        return false;
      }

      // Check file size (should be around 200-300 bytes for APNs key)
      const fileSize = content.length;
      if (fileSize < 100 || fileSize > 1000) {
        this.addResult(
          false,
          '.p8 file size is unusual',
          `File size: ${fileSize} bytes. Expected: 200-400 bytes. File may be corrupted.`
        );
        return false;
      }

      // Extract key content between headers
      const keyContent = content
        .split('-----BEGIN PRIVATE KEY-----')[1]
        ?.split('-----END PRIVATE KEY-----')[0]
        ?.trim();

      if (!keyContent) {
        this.addResult(
          false,
          '.p8 file has no key content',
          'No content found between PEM headers'
        );
        return false;
      }

      // Check if content is base64 (basic check)
      const base64Regex = /^[A-Za-z0-9+/=\s]+$/;
      if (!base64Regex.test(keyContent)) {
        this.addResult(
          false,
          '.p8 file content is not valid base64',
          'Key content should be base64 encoded'
        );
        return false;
      }

      this.addResult(
        true,
        '.p8 file format is valid',
        `File size: ${fileSize} bytes, PKCS#8 PEM format detected`
      );
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if ('code' in error && error.code === 'ENOENT') {
          this.addResult(
            false,
            '.p8 file not found',
            `File does not exist: ${filePath}`
          );
        } else {
          this.addResult(
            false,
            'Error reading .p8 file',
            error.message
          );
        }
      } else {
        this.addResult(
          false,
          'Unknown error reading .p8 file',
          String(error)
        );
      }
      return false;
    }
  }

  /**
   * Extract Key ID from filename
   */
  extractKeyIdFromFilename(filePath: string): string | null {
    // Expected format: AuthKey_ABC1234DEF.p8
    const match = filePath.match(/AuthKey_([A-Z0-9]{10})\.p8$/);
    return match ? match[1] : null;
  }

  /**
   * Run all validations
   */
  validate(keyId: string, teamId: string, p8FilePath: string): boolean {
    console.log('Starting APNs key validation...\n');

    // 1. Validate Key ID
    const keyIdValid = this.validateKeyId(keyId);

    // 2. Validate Team ID
    const teamIdValid = this.validateTeamId(teamId);

    // 3. Validate .p8 file
    const p8FileValid = this.validateP8File(p8FilePath);

    // 4. Cross-check Key ID with filename
    const filenameKeyId = this.extractKeyIdFromFilename(p8FilePath);
    if (filenameKeyId && filenameKeyId !== keyId) {
      this.addResult(
        false,
        'Key ID does not match filename',
        `Filename suggests Key ID: ${filenameKeyId}, but provided: ${keyId}`
      );
    } else if (filenameKeyId) {
      this.addResult(
        true,
        'Key ID matches filename',
        'Consistency check passed'
      );
    }

    // Print results
    this.printResults();

    // Return overall success
    return this.results.every(r => r.valid);
  }
}

/**
 * Prompt user for input
 */
async function promptForInput(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('APNs Authentication Key Validator\n');

  let p8FilePath = process.argv[2];
  let keyId = process.argv[3];
  let teamId = process.argv[4];

  // Prompt for missing inputs
  if (!p8FilePath) {
    p8FilePath = await promptForInput('Enter path to .p8 file: ');
  }

  if (!keyId) {
    keyId = await promptForInput('Enter Key ID (10 characters): ');
  }

  if (!teamId) {
    teamId = await promptForInput('Enter Team ID (10 characters): ');
  }

  if (!p8FilePath || !keyId || !teamId) {
    console.error('Error: All parameters are required');
    console.error('Usage: pnpm --filter api run validate-apns <p8-file> <key-id> <team-id>');
    process.exit(1);
  }

  const validator = new APNsKeyValidator();
  const isValid = validator.validate(keyId.toUpperCase(), teamId.toUpperCase(), p8FilePath);

  if (isValid) {
    console.log('✓ APNs key validation passed! Ready to upload to Firebase.\n');
    console.log('Next steps:');
    console.log('1. Go to Firebase Console > Project Settings > Cloud Messaging');
    console.log('2. Upload the .p8 file');
    console.log(`3. Enter Key ID: ${keyId.toUpperCase()}`);
    console.log(`4. Enter Team ID: ${teamId.toUpperCase()}\n`);
    process.exit(0);
  } else {
    console.error('✗ APNs key validation failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  console.error('Unexpected error during validation:', error);
  process.exit(1);
});
