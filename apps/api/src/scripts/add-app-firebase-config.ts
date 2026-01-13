#!/usr/bin/env node
/**
 * Add Firebase Configuration to Application
 *
 * This script adds or updates Firebase service account configuration
 * for a specific application in the database.
 *
 * Usage:
 *   pnpm --filter api run add-app-firebase-config
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { config } from '@dotenvx/dotenvx';
import { db } from '@push-platform/db';
import { applications } from '@push-platform/db/schema';
import { eq, or } from 'drizzle-orm';

// Load environment variables
config();

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

    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
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
  console.log('Add Firebase Configuration to Application');
  console.log('='.repeat(70) + '\n');

  try {
    // Get application identifier
    const appIdentifier = await question('Enter application slug or ID: ');

    if (!appIdentifier) {
      console.error('Error: Application identifier is required');
      rl.close();
      process.exit(1);
    }

    // Find application
    console.log(`\nLooking up application: ${appIdentifier}...`);

    const app = await db.query.applications.findFirst({
      where: or(
        eq(applications.slug, appIdentifier),
        eq(applications.id, appIdentifier)
      )
    });

    if (!app) {
      console.error(`✗ Application not found: ${appIdentifier}`);
      console.error('\nAvailable applications:');

      const allApps = await db.query.applications.findMany({
        columns: {
          id: true,
          slug: true,
          name: true
        }
      });

      allApps.forEach(a => {
        console.log(`  - ${a.slug} (${a.name})`);
      });

      rl.close();
      process.exit(1);
    }

    console.log(`✓ Found application: ${app.name} (${app.slug})`);

    // Check current configuration
    if (app.firebaseConfig) {
      const currentProjectId = (app.firebaseConfig as any).project_id;
      console.log(`\n⚠️  This application already has Firebase configuration`);
      console.log(`   Current project: ${currentProjectId}`);

      const overwrite = await question('Do you want to overwrite it? (y/n): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('\nOperation cancelled.');
        rl.close();
        process.exit(0);
      }
    }

    // Get service account file path
    console.log('');
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
      console.error(`✗ Invalid service account: ${validation.error}`);
      rl.close();
      process.exit(1);
    }

    console.log(`✓ Service account validated`);
    console.log(`  Project ID: ${validation.projectId}\n`);

    // Confirm update
    const confirm = await question(`Update ${app.slug} with this Firebase configuration? (y/n): `);

    if (confirm.toLowerCase() !== 'y') {
      console.log('\nOperation cancelled.');
      rl.close();
      process.exit(0);
    }

    // Update database
    const serviceAccount = JSON.parse(serviceAccountJson);

    await db.update(applications)
      .set({
        firebaseConfig: serviceAccount,
        updatedAt: new Date()
      })
      .where(eq(applications.id, app.id));

    console.log('\n' + '='.repeat(70));
    console.log('✓ Firebase configuration updated successfully!');
    console.log('='.repeat(70) + '\n');

    console.log('Application Details:');
    console.log(`  Name: ${app.name}`);
    console.log(`  Slug: ${app.slug}`);
    console.log(`  ID: ${app.id}`);
    console.log(`  Firebase Project: ${validation.projectId}`);
    console.log('');

    console.log('Next steps:');
    console.log('  1. Test push notification for this application');
    console.log(`  2. POST /v1/${app.slug}/push with valid device tokens`);
    console.log('  3. Check worker logs to verify correct Firebase project is used');
    console.log('  4. View all configs: pnpm --filter api run list-firebase-configs');
    console.log('');

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    rl.close();
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  rl.close();
  process.exit(1);
});
