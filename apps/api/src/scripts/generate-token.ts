import '@dotenvx/dotenvx/config';
import { db } from '@push-platform/db';
import { applications, tenants, onboardingTokens } from '@push-platform/db';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { DEFAULT_TOKEN_EXPIRY_MS } from '@push-platform/shared';

interface GenerateTokenOptions {
  appSlug: string;
  tenantSlug: string;
  expiresInHours?: number;
  metadata?: Record<string, unknown>;
}

function parseArgs(): GenerateTokenOptions {
  const args = process.argv.slice(2);
  const options: Partial<GenerateTokenOptions> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--appSlug' && args[i + 1]) {
      options.appSlug = args[i + 1];
      i++;
    } else if (args[i] === '--tenantSlug' && args[i + 1]) {
      options.tenantSlug = args[i + 1];
      i++;
    } else if (args[i] === '--expiresIn' && args[i + 1]) {
      options.expiresInHours = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--metadata' && args[i + 1]) {
      try {
        options.metadata = JSON.parse(args[i + 1]);
      } catch (error) {
        console.error('Invalid metadata JSON');
        process.exit(1);
      }
      i++;
    }
  }

  if (!options.appSlug || !options.tenantSlug) {
    console.error('Usage: npm run generate-token -- --appSlug <slug> --tenantSlug <slug> [--expiresIn <hours>] [--metadata <json>]');
    console.error('\nExample:');
    console.error('  npm run generate-token -- --appSlug myapp --tenantSlug tenant1');
    console.error('  npm run generate-token -- --appSlug myapp --tenantSlug tenant1 --expiresIn 48');
    console.error('  npm run generate-token -- --appSlug myapp --tenantSlug tenant1 --metadata \'{"topics":["news","updates"]}\'');
    process.exit(1);
  }

  return options as GenerateTokenOptions;
}

function generateRandomToken(length: number = 32): string {
  return randomBytes(length)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, length);
}

async function generateToken() {
  const options = parseArgs();

  console.log('Generating onboarding token...');
  console.log(`Application: ${options.appSlug}`);
  console.log(`Tenant: ${options.tenantSlug}`);

  try {
    // Find application
    const app = await db.query.applications.findFirst({
      where: eq(applications.slug, options.appSlug),
    });

    if (!app) {
      console.error(`Application not found: ${options.appSlug}`);
      console.error('Run "npm run seed-data" to create sample application');
      process.exit(1);
    }

    // Find tenant
    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.applicationId, app.id), eq(tenants.slug, options.tenantSlug)),
    });

    if (!tenant) {
      console.error(`Tenant not found: ${options.tenantSlug}`);
      console.error('Make sure the tenant exists for this application');
      process.exit(1);
    }

    // Generate token
    const token = generateRandomToken(32);
    const expiresInMs = options.expiresInHours ? options.expiresInHours * 60 * 60 * 1000 : DEFAULT_TOKEN_EXPIRY_MS;
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Insert token
    await db.insert(onboardingTokens).values({
      applicationId: app.id,
      tenantId: tenant.id,
      token,
      metadata: options.metadata || null,
      expiresAt,
    });

    console.log('\n✓ Onboarding token generated successfully!');
    console.log(`\nToken: ${token}`);
    console.log(`Expires: ${expiresAt.toISOString()}`);
    if (options.metadata) {
      console.log(`Metadata: ${JSON.stringify(options.metadata)}`);
    }
    console.log('\nUse this token to onboard devices via the API:');
    console.log(`POST /v1/${options.appSlug}/onboard/resolve`);
    console.log(`Body: {"token": "${token}"}`);

    process.exit(0);
  } catch (error) {
    console.error('Error generating token:', error);
    process.exit(1);
  }
}

generateToken();
