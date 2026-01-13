# Multi-Application Firebase Configuration

This guide explains how to configure multiple Firebase projects for different applications in the Push Platform, enabling true multi-tenant support.

## Overview

The Push Platform supports multiple applications, each with its own Firebase Cloud Messaging configuration. This enables:

- **White-label deployments**: Different customers can use their own Firebase projects
- **Application isolation**: Each app's notifications are independent
- **Flexible configuration**: Mix global and per-app Firebase settings
- **Easy scaling**: Add new applications without platform reconfiguration

## Architecture

### FirebaseRegistry Singleton

The platform uses a `FirebaseRegistry` singleton (located in `packages/shared/src/firebase/registry.ts`) that:

- Manages Firebase app instances per `applicationId`
- Caches instances in memory for performance
- Supports development mode (project ID only) and production mode (service account)
- Falls back to global environment variables when app config is not specified

### Application Schema

Each application in the database has a `firebaseConfig` JSONB column:

```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  firebase_config JSONB,  -- Stores service account credentials
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

## Configuration Modes

### Global Configuration (Simplest)

All applications share the same Firebase project.

**When to use:**
- Single tenant deployment
- All iOS apps belong to same organization
- Simplified management

**Configuration:**
- Set `SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID` environment variable
- Leave `firebaseConfig` as `null` in database
- All applications use global Firebase settings

**Example:**

```typescript
// Application in database
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  slug: "my-app",
  name: "My Application",
  firebaseConfig: null  // Uses global config
}
```

### Per-Application Configuration (Advanced)

Each application has its own Firebase project.

**When to use:**
- Multi-tenant / white-label platform
- Different customers want their own Firebase projects
- Strong tenant isolation required
- Customers manage their own Firebase Console

**Configuration:**
- Store service account JSON in `firebaseConfig` column
- Each application sends notifications through its own Firebase project
- Optional global fallback for apps without specific config

**Example:**

```typescript
// Application in database
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  slug: "customer-a-app",
  name: "Customer A Application",
  firebaseConfig: {
    type: "service_account",
    project_id: "customer-a-firebase-proj",
    private_key_id: "...",
    private_key: "-----BEGIN PRIVATE KEY-----\n...",
    client_email: "firebase-adminsdk-...@customer-a-firebase-proj.iam.gserviceaccount.com",
    client_id: "..."
  }
}
```

### Hybrid Configuration (Flexible)

Mix global and per-app configurations.

**When to use:**
- Transitioning from single to multi-tenant
- Most apps use global config, but some need dedicated Firebase
- Testing per-app configs before full migration

**Configuration:**
- Set global `SERVICE_ACCOUNT_JSON` for default
- Override with per-app `firebaseConfig` for specific applications
- Platform automatically uses per-app config when available

## Implementation Details

### How FirebaseRegistry Works

```typescript
// From packages/shared/src/firebase/registry.ts

async getClient(applicationId: string, firebaseConfig?: Record<string, unknown>): Promise<App> {
  // 1. Return cached app if exists
  if (this.apps.has(applicationId)) {
    return this.apps.get(applicationId)!;
  }

  // 2. Development mode: use project ID only
  if (isDevelopment && projectId && !firebaseConfig) {
    app = initializeApp({ projectId }, applicationId);
  }

  // 3. Per-app config: use from database
  else if (firebaseConfig) {
    app = initializeApp({ credential: cert(firebaseConfig) }, applicationId);
  }

  // 4. Global fallback: use SERVICE_ACCOUNT_JSON
  else {
    const serviceAccountJson = getEnvOptional('SERVICE_ACCOUNT_JSON');
    if (serviceAccountJson) {
      app = initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) }, applicationId);
    } else {
      throw new Error('Firebase configuration not found');
    }
  }

  // 5. Cache for future use
  this.apps.set(applicationId, app);
  return app;
}
```

### Configuration Precedence

When sending a push notification, Firebase credentials are loaded in this order:

1. **Per-application `firebaseConfig`** from database (if set)
2. **Global `SERVICE_ACCOUNT_JSON`** environment variable
3. **Global `FIREBASE_CREDENTIALS_PATH`** environment variable
4. **Development `FIREBASE_PROJECT_ID`** (if NODE_ENV=development)
5. **Error** if none found

## Setting Up Multi-Application Firebase

### Option 1: Using the Script (Recommended)

```bash
# Add Firebase config to an application
pnpm --filter api run add-app-firebase-config
```

The script will:
1. Prompt for application slug or ID
2. Ask for service account JSON file path
3. Validate the JSON
4. Update the database with Firebase configuration
5. Confirm success

### Option 2: Manually via Database

```sql
-- Update application with Firebase config
UPDATE applications
SET firebase_config = '{
  "type": "service_account",
  "project_id": "customer-firebase-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@customer-firebase-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}'::jsonb
WHERE slug = 'customer-a-app';
```

### Option 3: Via API/Application Code

```typescript
import { db } from '@push-platform/db';
import { applications } from '@push-platform/db/schema';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';

// Read service account JSON
const serviceAccount = JSON.parse(
  readFileSync('/path/to/firebase-credentials.json', 'utf-8')
);

// Update application
await db.update(applications)
  .set({ firebaseConfig: serviceAccount })
  .where(eq(applications.slug, 'customer-app'));
```

## Listing Firebase Configurations

### Using the Script

```bash
pnpm --filter api run list-firebase-configs
```

Output example:

```
Firebase Configuration Status
==============================

Application: my-app (123e4567...)
  Config: Global fallback
  Project: push-platform-prod-abc123 (from environment)

Application: customer-a-app (234f5678...)
  Config: Per-application
  Project: customer-a-firebase-proj

Application: customer-b-app (345g6789...)
  Config: Per-application
  Project: customer-b-firebase-proj

Summary: 3 applications (1 global, 2 per-app)
```

### Via Database Query

```sql
SELECT
  slug,
  name,
  CASE
    WHEN firebase_config IS NULL THEN 'Global fallback'
    ELSE 'Per-application'
  END as config_type,
  firebase_config->>'project_id' as project_id
FROM applications
ORDER BY slug;
```

## Use Cases and Examples

### Use Case 1: White-Label Platform

**Scenario:** You run a white-label push platform for multiple customers. Each customer has their own Firebase project.

**Setup:**

1. Customer A provides their Firebase service account JSON
2. You create an application: `customer-a-app`
3. Store their service account in `firebaseConfig`
4. Customer A's push notifications go through their Firebase project
5. Repeat for Customer B, C, etc.

**Benefits:**
- Customer controls their Firebase Console
- Customer sees their own analytics
- Complete data isolation
- Customer can configure APNs independently

### Use Case 2: Environment Separation

**Scenario:** You want separate Firebase projects for dev/staging/prod.

**Setup:**

```typescript
// Development application
{
  slug: "myapp-dev",
  firebaseConfig: null  // Uses FIREBASE_PROJECT_ID=myapp-dev-proj
}

// Staging application
{
  slug: "myapp-staging",
  firebaseConfig: {
    // Staging Firebase service account
    project_id: "myapp-staging-proj",
    ...
  }
}

// Production application
{
  slug: "myapp-prod",
  firebaseConfig: {
    // Production Firebase service account
    project_id: "myapp-prod-proj",
    ...
  }
}
```

### Use Case 3: Gradual Migration

**Scenario:** Migrating from single-tenant to multi-tenant.

**Phase 1:**
- All applications use global `SERVICE_ACCOUNT_JSON`
- No per-app configs

**Phase 2:**
- Add per-app config for new customers
- Existing apps continue using global config

**Phase 3:**
- Migrate existing apps to per-app configs
- Remove global `SERVICE_ACCOUNT_JSON` (optional)

## Security Considerations

### Credential Storage

Per-application Firebase credentials are stored in the database:

**Pros:**
- Easy to manage via admin UI
- No environment variable proliferation
- Can be encrypted at rest with database encryption

**Cons:**
- Database compromise exposes all credentials
- Credentials in database backups

**Recommendations:**
1. **Enable database encryption** at rest
2. **Encrypt backups** and restrict access
3. **Use database access controls** (row-level security if supported)
4. **Audit access** to applications table
5. **Consider external secret storage** for highest security requirements

### Alternative: External Secret References

For maximum security, store only secret references in database:

```typescript
// Store reference instead of full credentials
{
  slug: "customer-app",
  firebaseConfig: {
    secretRef: "aws:secretsmanager:us-east-1:customer-a-firebase"
  }
}

// Retrieve actual credentials from secret manager at runtime
const credentials = await secretsManager.getSecret(app.firebaseConfig.secretRef);
```

**Note:** This requires custom implementation beyond the default platform behavior.

## Testing Multi-Application Setup

### Test Different Applications

```bash
# Send push notification for App A (uses its own Firebase)
curl -X POST http://localhost:3000/v1/customer-a-app/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceTokens": ["token-for-app-a"],
    "notification": {
      "title": "Hello from App A",
      "body": "This goes through customer-a Firebase project"
    }
  }'

# Send push notification for App B (uses different Firebase)
curl -X POST http://localhost:3000/v1/customer-b-app/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceTokens": ["token-for-app-b"],
    "notification": {
      "title": "Hello from App B",
      "body": "This goes through customer-b Firebase project"
    }
  }'
```

### Verify Correct Firebase Project Usage

Check worker logs to confirm which Firebase project was used:

```
[Worker] Processing delivery for application: customer-a-app
[Worker] Using Firebase project: customer-a-firebase-proj
[Worker] FCM message sent successfully: projects/customer-a-firebase-proj/messages/0:1234567890
```

## Troubleshooting

### Issue: "Firebase configuration not found"

**Cause:** No global config and no per-app config

**Solution:**
- Check `firebaseConfig` in database: `SELECT firebase_config FROM applications WHERE slug = 'app-slug'`
- If null, ensure global `SERVICE_ACCOUNT_JSON` is set
- Or add per-app config: `pnpm --filter api run add-app-firebase-config`

### Issue: "Wrong Firebase project used"

**Cause:** Per-app config not set correctly

**Solution:**
- Verify firebaseConfig: `SELECT firebase_config->>'project_id' FROM applications WHERE slug = 'app-slug'`
- Check worker logs for actual project used
- Validate JSON structure in database

### Issue: "Credential mismatch error"

**Cause:** Service account from wrong Firebase project

**Solution:**
- Ensure service account JSON is from correct Firebase project
- Verify bundle ID matches between iOS app and Firebase project
- Check APNs key is uploaded to correct Firebase project

## Migration Guide

### From Single-Tenant to Multi-Tenant

**Step 1:** Audit current setup
```bash
# List all applications
pnpm --filter api run list-firebase-configs
```

**Step 2:** For each customer needing dedicated Firebase:

1. Customer creates Firebase project
2. Customer registers iOS app in their Firebase
3. Customer uploads APNs key to their Firebase
4. Customer generates service account JSON
5. Customer provides service account to you (securely)

**Step 3:** Add per-app config
```bash
pnpm --filter api run add-app-firebase-config
# Follow prompts for each customer app
```

**Step 4:** Test each application
```bash
# Send test notification for each app
# Verify correct Firebase project in logs
```

**Step 5:** Monitor and validate
- Check push delivery rates haven't changed
- Verify customers see notifications in their Firebase Analytics
- Confirm no cross-application notification leaks

## Best Practices

1. **Document ownership**: Track which Firebase project belongs to which customer
2. **Separate environments**: Use different Firebase projects for dev/staging/prod
3. **Audit configs**: Regularly review which apps have per-app configs
4. **Test isolation**: Verify push notifications don't cross applications
5. **Backup credentials**: Store service account JSONs securely outside database
6. **Monitor usage**: Track Firebase usage per application
7. **Rotate credentials**: Implement rotation schedule per customer

## Additional Resources

- [Firebase Registry Implementation](../../packages/shared/src/firebase/registry.ts)
- [Application Schema](../../packages/db/src/schema/applications.ts)
- [DeliveryProcessor Worker](../../apps/worker/src/processor.ts)
- [Environment Configuration](./environment-configuration.md)
