# Firebase Service Account Setup

This guide covers generating Firebase service account credentials and configuring them for server-side access to Firebase Cloud Messaging.

## Prerequisites

- Firebase project created (see [Firebase Project Setup](./firebase-project-setup.md))
- APNs key uploaded to Firebase (see [APNs Key Setup](./apns-key-setup.md))
- Admin access to Firebase Console

## Understanding Service Accounts

### What is a Firebase Service Account?

A service account is a special Google account that represents your application (not a user). It's used for server-to-server authentication with Firebase.

### Why Service Accounts are Needed

- **Server-side authentication**: Backend services need credentials to send push notifications
- **No user interaction**: Service accounts work without user login
- **Granular permissions**: Can be scoped to specific Firebase services
- **Key rotation**: Can create multiple keys and rotate them periodically

### Development vs Production

| Mode | Authentication Method | Credentials Required |
|------|----------------------|---------------------|
| Development | Project ID only | FIREBASE_PROJECT_ID environment variable |
| Production | Service Account | SERVICE_ACCOUNT_JSON or FIREBASE_CREDENTIALS_PATH |

In development mode, the Firebase Admin SDK can work with just a project ID (useful for emulator or testing). In production, full service account credentials are required.

## Step 1: Generate Service Account Key

### Navigate to Service Accounts

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your Firebase project
3. Click **gear icon** > **Project Settings**
4. Select **Service Accounts** tab

### Select SDK Configuration

1. Under "Firebase Admin SDK", select **Node.js** configuration
2. You'll see instructions for initializing the Firebase Admin SDK
3. Locate the **"Generate new private key"** button

### Generate and Download Key

1. Click **"Generate new private key"**
2. A warning dialog appears: *"This key allows anyone to access your Firebase project. Store it securely and never commit it to version control."*
3. Click **"Generate key"** to confirm
4. A JSON file downloads automatically (filename format: `<project-name>-firebase-adminsdk-<id>.json`)
5. **Rename** the file to `firebase-credentials.json` for consistency

## Step 2: Understand Service Account JSON Structure

The downloaded JSON file contains all credentials needed for authentication.

### Required Fields

```json
{
  "type": "service_account",
  "project_id": "<YOUR_PROJECT_ID>",
  "private_key_id": "<KEY_ID_HERE>",
  "private_key": "<PRIVATE_KEY_PEM_HERE>",
  "client_email": "<SERVICE_ACCOUNT_EMAIL>",
  "client_id": "<CLIENT_ID>",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "<CERT_URL>"
}
```

### Field Descriptions

| Field | Description | Usage |
|-------|-------------|-------|
| `type` | Account type | Must be "service_account" |
| `project_id` | Firebase project ID | Identifies your Firebase project |
| `private_key_id` | Private key identifier | Used for key rotation tracking |
| `private_key` | RSA private key | Actual signing key for authentication |
| `client_email` | Service account email | Identifies this specific service account |
| `client_id` | Numeric client ID | Google Cloud identifier |

### Validation Checklist

- [ ] `type` equals `"service_account"`
- [ ] `project_id` matches your Firebase project ID
- [ ] `private_key` starts with `-----BEGIN PRIVATE KEY-----`
- [ ] `private_key` ends with `-----END PRIVATE KEY-----`
- [ ] `client_email` ends with `@*.iam.gserviceaccount.com`
- [ ] All required fields are present

## Step 3: Store Service Account Securely

### DO NOT Commit to Git

The service account JSON is already excluded in .gitignore:

```gitignore
# Firebase Configuration Files
firebase-credentials.json
firebase-credentials-*.json
*-adminsdk-*.json
```

### For Development

```bash
# Create secure directory
mkdir -p ~/.firebase-credentials
chmod 700 ~/.firebase-credentials

# Move downloaded file
mv ~/Downloads/*-firebase-adminsdk-*.json ~/.firebase-credentials/firebase-credentials.json
chmod 600 ~/.firebase-credentials/firebase-credentials.json
```

### For Production

Use enterprise secret management systems:

#### AWS Secrets Manager

```bash
# Store as JSON secret
aws secretsmanager create-secret \
  --name push-platform/firebase-credentials \
  --secret-string file://firebase-credentials.json

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id push-platform/firebase-credentials \
  --query SecretString \
  --output text
```

#### Google Cloud Secret Manager

```bash
# Create secret
gcloud secrets create firebase-service-account \
  --data-file=firebase-credentials.json

# Access in application
gcloud secrets versions access latest \
  --secret=firebase-service-account
```

#### HashiCorp Vault

```bash
# Store in KV v2 secrets engine
vault kv put secret/push-platform/firebase @firebase-credentials.json

# Retrieve in application
vault kv get -field=data secret/push-platform/firebase
```

## Step 4: Validate Service Account

Use the validation script to verify the JSON structure:

```bash
pnpm --filter api run validate-service-account /path/to/firebase-credentials.json
```

The script validates:
- All required fields are present
- Field formats are correct (email, key format, etc.)
- Can successfully authenticate with Firebase
- Project ID matches expected value

### Expected Output

```
Service Account Validation Results
===================================

✓ PASS: Service account JSON structure is valid
✓ PASS: Type field is correct: service_account
✓ PASS: Project ID is valid: push-platform-prod-abc123
✓ PASS: Private key format is valid (PEM format)
✓ PASS: Client email format is valid
✓ PASS: All required fields present
✓ PASS: Firebase authentication successful

Summary: 7 passed, 0 failed
```

## Step 5: Configure Environment Variables

You have two options for providing service account credentials to the application.

### Option 1: Base64 Encoded (Recommended for containers)

Convert JSON to base64 string:

```bash
# Use the provided script
pnpm --filter api run json-to-base64 /path/to/firebase-credentials.json
```

This outputs a base64-encoded string. Set as environment variable:

```bash
export SERVICE_ACCOUNT_JSON="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsC..."
```

**Advantages:**
- Works in any environment (Docker, Kubernetes, cloud platforms)
- Single environment variable
- No file system dependencies

### Option 2: File Path

Point to the JSON file location:

```bash
export FIREBASE_CREDENTIALS_PATH="/secure/path/firebase-credentials.json"
```

**Advantages:**
- Easier to manage locally
- Can update file without changing environment variable
- Simpler for development

**Disadvantages:**
- Requires file system access
- More complex in containerized environments

### Update .env File

For development:

```bash
# Development mode (project ID only, no credentials)
FIREBASE_PROJECT_ID=push-platform-dev-abc123
NODE_ENV=development
```

For production:

```bash
# Production mode (service account credentials)
SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# OR
FIREBASE_CREDENTIALS_PATH=/path/to/firebase-credentials.json

NODE_ENV=production
```

## Step 6: Test Authentication

Test the service account configuration:

```bash
# Validate environment configuration
pnpm --filter api run validate-env

# Validate Firebase configuration specifically
pnpm --filter api run validate-firebase
```

Both scripts will:
- Check environment variables are set correctly
- Validate service account JSON structure
- Test Firebase authentication
- Verify Firebase Messaging API access

## Service Account Permissions

### Default Permissions

Newly created service accounts have **Editor** role by default, which includes:
- Full read/write access to Firebase project
- Access to all Firebase services
- Cloud Messaging send permissions

### Principle of Least Privilege (Advanced)

For production, consider limiting permissions:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project
3. Navigate to **IAM & Admin > IAM**
4. Find your service account (email from JSON file)
5. Edit permissions and grant only:
   - **Firebase Cloud Messaging Admin**
   - Remove other unnecessary permissions

**Note:** This is optional but recommended for high-security environments.

## Service Account Key Management

### Key Rotation Strategy

**Recommended Schedule:** Every 90 days for production

#### Rotation Process

1. Generate new service account key (Step 1)
2. Update environment variable with new credentials
3. Deploy updated configuration
4. Test push notifications with new key
5. Delete old key in Firebase Console
6. Update documentation with rotation date

### Maximum Keys per Service Account

- Google allows **up to 10 active keys** per service account
- Recommended: Keep only 2 keys active (current + previous for rollback)
- Delete old keys after successful rotation

### Delete Old Keys

1. Go to Firebase Console > Service Accounts
2. Click **"Manage service account keys"** link
3. This opens Google Cloud Console
4. Find keys to delete (listed by creation date)
5. Click **three dots** > **Delete**
6. Confirm deletion

**WARNING:** Deleting a key immediately invalidates it. Ensure new key is deployed first.

## Security Best Practices

### 1. Never Commit to Version Control

- Service account JSON contains private keys
- Immediately revoke and rotate if accidentally committed
- Use git-secrets or similar tools to prevent commits

### 2. Encrypt at Rest

- Store in encrypted secret management systems
- Use encrypted filesystems for local storage
- Enable encryption in cloud secret managers

### 3. Limit Access

- Only essential personnel should access service account keys
- Use role-based access control (RBAC)
- Audit access logs regularly

### 4. Monitor Usage

- Enable Cloud Audit Logs for service account usage
- Alert on unusual authentication patterns
- Track API call volumes

### 5. Separate by Environment

- Use different service accounts for dev/staging/prod
- Never share service accounts across environments
- Easier to audit and rotate credentials

### 6. Document Everything

- Track which keys are active
- Document rotation dates
- Maintain recovery procedures

## Multi-Environment Configuration

### Example: Three Environments

| Environment | Service Account Email | Storage Location |
|-------------|----------------------|------------------|
| Development | firebase-adminsdk-dev@...iam.gserviceaccount.com | Local file system |
| Staging | firebase-adminsdk-staging@...iam.gserviceaccount.com | AWS Secrets Manager |
| Production | firebase-adminsdk-prod@...iam.gserviceaccount.com | AWS Secrets Manager + encrypted backup |

### Why Separate Service Accounts?

- **Security**: Limit blast radius if key is compromised
- **Auditing**: Track which environment is making requests
- **Quota management**: Separate Firebase quotas per environment
- **Rollback**: Can revert production without affecting staging

## Troubleshooting

### Issue: "Invalid service account JSON"

**Cause:** Malformed JSON or missing fields

**Solution:**
- Re-download from Firebase Console
- Run validation script: `pnpm --filter api run validate-service-account`
- Ensure file wasn't edited manually
- Check for copy/paste errors if using base64 encoding

### Issue: "Permission denied" errors

**Cause:** Service account lacks necessary permissions

**Solution:**
- Verify service account has Editor or Firebase Cloud Messaging Admin role
- Check in Google Cloud Console > IAM & Admin
- May need to wait 5-10 minutes for permission changes to propagate

### Issue: "Authentication failed"

**Cause:** Private key or client email is incorrect

**Solution:**
- Verify JSON file is complete and unmodified
- Check that environment variable is set correctly
- For base64 approach, ensure proper encoding/decoding
- Try re-generating service account key

### Issue: "Project ID mismatch"

**Cause:** Service account is from different Firebase project

**Solution:**
- Verify `project_id` in JSON matches your Firebase project
- Download service account from correct project
- Check FIREBASE_PROJECT_ID environment variable matches

## Next Steps

After completing service account setup:

1. [Configure environment variables](./environment-configuration.md)
2. [Set up multi-application Firebase support](./multi-app-configuration.md)
3. [Test push notifications](./testing-guide.md)

## Additional Resources

- [Firebase Service Accounts Documentation](https://firebase.google.com/docs/admin/setup)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Firebase Admin SDK Reference](https://firebase.google.com/docs/reference/admin)
- [Best Practices for Service Account Keys](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
