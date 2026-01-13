#!/usr/bin/env node
/**
 * List Firebase Configurations for All Applications
 *
 * This script displays which applications use per-app Firebase configs
 * vs global fallback configuration.
 *
 * Usage:
 *   pnpm --filter api run list-firebase-configs
 */

import { config } from '@dotenvx/dotenvx';
import { db } from '@push-platform/db';

// Load environment variables
config();

async function main() {
  console.log('='.repeat(70));
  console.log('Firebase Configuration Status');
  console.log('='.repeat(70) + '\n');

  try {
    // Get global Firebase config from environment
    const globalProjectId = process.env.FIREBASE_PROJECT_ID;
    const hasGlobalServiceAccount = !!process.env.SERVICE_ACCOUNT_JSON || !!process.env.FIREBASE_CREDENTIALS_PATH;
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Determine global config status
    let globalConfig = 'Not configured';
    if (nodeEnv === 'development' && globalProjectId) {
      globalConfig = `Project ID: ${globalProjectId} (development mode)`;
    } else if (hasGlobalServiceAccount) {
      try {
        const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
        if (serviceAccountJson) {
          const serviceAccount = JSON.parse(serviceAccountJson);
          globalConfig = `Project ID: ${serviceAccount.project_id} (production mode)`;
        } else {
          globalConfig = `File path: ${process.env.FIREBASE_CREDENTIALS_PATH} (production mode)`;
        }
      } catch {
        globalConfig = 'Configured (unable to parse)';
      }
    }

    console.log('Global Firebase Configuration:');
    console.log(`  Environment: ${nodeEnv}`);
    console.log(`  Status: ${globalConfig}`);
    console.log('');
    console.log('-'.repeat(70));
    console.log('');

    // Get all applications
    const apps = await db.query.applications.findMany({
      columns: {
        id: true,
        slug: true,
        name: true,
        firebaseConfig: true,
        createdAt: true
      },
      orderBy: (applications, { asc }) => [asc(applications.slug)]
    });

    if (apps.length === 0) {
      console.log('No applications found in database.');
      console.log('\nCreate an application using:');
      console.log('  pnpm --filter api run seed-data');
      console.log('');
      process.exit(0);
    }

    let globalCount = 0;
    let perAppCount = 0;

    apps.forEach((app, index) => {
      const hasPerAppConfig = app.firebaseConfig !== null;
      const configType = hasPerAppConfig ? 'Per-application' : 'Global fallback';
      const icon = hasPerAppConfig ? '🔧' : '🌐';

      console.log(`${icon} Application: ${app.name}`);
      console.log(`   Slug: ${app.slug}`);
      console.log(`   ID: ${app.id.substring(0, 8)}...`);
      console.log(`   Config: ${configType}`);

      if (hasPerAppConfig) {
        const firebaseConfig = app.firebaseConfig as any;
        console.log(`   Project: ${firebaseConfig.project_id}`);
        console.log(`   Client: ${firebaseConfig.client_email}`);
        perAppCount++;
      } else {
        console.log(`   Project: ${globalConfig}`);
        globalCount++;
      }

      console.log(`   Created: ${app.createdAt.toISOString().split('T')[0]}`);

      if (index < apps.length - 1) {
        console.log('');
      }
    });

    console.log('');
    console.log('='.repeat(70));
    console.log('Summary');
    console.log('='.repeat(70));
    console.log(`Total applications: ${apps.length}`);
    console.log(`  - Using global config: ${globalCount}`);
    console.log(`  - Using per-app config: ${perAppCount}`);
    console.log('');

    // Warnings and recommendations
    if (globalCount > 0 && !hasGlobalServiceAccount && nodeEnv !== 'development') {
      console.log('⚠️  WARNING: Some applications rely on global config, but no global');
      console.log('   SERVICE_ACCOUNT_JSON is set in production mode.');
      console.log('');
    }

    if (perAppCount > 0) {
      console.log('💡 TIP: Per-app configs enable multi-tenant deployments.');
      console.log('   Each application can use its own Firebase project.');
      console.log('');
    }

    console.log('To add Firebase config to an application:');
    console.log('  pnpm --filter api run add-app-firebase-config');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
