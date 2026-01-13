# Firebase Configuration Files

This directory is for storing Firebase configuration files during development.

## WARNING: DO NOT COMMIT SENSITIVE FILES

The following files contain sensitive credentials and should **NEVER** be committed to version control:

- `firebase-credentials.json` - Firebase service account credentials
- `*-adminsdk-*.json` - Any Firebase admin SDK credentials
- `GoogleService-Info.plist` - iOS app Firebase configuration
- `*.p8` - APNs authentication keys
- Any file with API keys or private keys

These files are already excluded in the root `.gitignore`.

## Purpose

This directory serves as:

1. **Example storage location** for local development
2. **Reference point** for where to place downloaded Firebase files
3. **Documentation** of what files are needed

## What Goes Here (Development Only)

### During Development

You may temporarily place these files here for local testing:

- `firebase-credentials-dev.json` - Development service account
- `firebase-credentials-staging.json` - Staging service account
- `GoogleService-Info-dev.plist` - Development iOS config
- `GoogleService-Info-staging.plist` - Staging iOS config

### File Organization Example

```
docs/firebase-config/
├── README.md (this file)
├── firebase-credentials-dev.json      # Development service account
├── firebase-credentials-staging.json  # Staging service account
└── (production files should be in secure secret storage, NOT here)
```

## Production Files

**NEVER** store production Firebase files in this directory or anywhere in the repository.

Production credentials should be stored in:

- AWS Secrets Manager
- Google Cloud Secret Manager
- HashiCorp Vault
- Azure Key Vault
- 1Password / LastPass team vaults
- Encrypted external storage

## How to Use These Files

### Service Account JSON

```bash
# Validate the file
pnpm --filter api run validate-service-account ./docs/firebase-config/firebase-credentials-dev.json

# Convert to base64 for environment variable
pnpm --filter api run json-to-base64 ./docs/firebase-config/firebase-credentials-dev.json

# Or set file path directly
export FIREBASE_CREDENTIALS_PATH="$(pwd)/docs/firebase-config/firebase-credentials-dev.json"
```

### GoogleService-Info.plist

```bash
# Extract configuration
pnpm --filter api run extract-app-id ./docs/firebase-config/GoogleService-Info-dev.plist
```

This file is primarily for the iOS client app, not the backend.

## Security Best Practices

1. **Never commit** these files to git
2. **Always verify** .gitignore includes these patterns
3. **Use separate files** for dev/staging/prod environments
4. **Rotate credentials** regularly (every 90 days for production)
5. **Delete files** when no longer needed
6. **Encrypt backups** if storing locally

## Verifying Files Are Not Tracked

Check that sensitive files are properly ignored:

```bash
# From project root
git status --ignored

# Should show files in this directory as ignored
# If not, they are NOT in .gitignore and should be added immediately
```

## Getting Firebase Configuration Files

### 1. Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Project Settings > Service Accounts
4. Click "Generate new private key"
5. Download and save to this directory (dev/staging only)

See: [Service Account Setup Guide](../implementation/service-account-setup.md)

### 2. GoogleService-Info.plist

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Project Settings > General
4. Scroll to "Your apps" > iOS app
5. Click gear icon > Download GoogleService-Info.plist
6. Save to this directory (for reference)

See: [iOS App Registration Guide](../implementation/ios-app-registration.md)

### 3. APNs .p8 Key

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Certificates, Identifiers & Profiles > Keys
3. Create new key with APNs enabled
4. Download .p8 file (ONE TIME ONLY!)
5. Store securely (NOT recommended to place in this directory)

See: [APNs Key Setup Guide](../implementation/apns-key-setup.md)

## If Files Are Accidentally Committed

If you accidentally commit sensitive files to git:

1. **Immediately** revoke the credentials in Firebase Console
2. Remove files from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch docs/firebase-config/firebase-credentials.json" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push to remote (if already pushed)
4. Generate new credentials
5. Notify your team of the incident

## Questions?

Refer to the comprehensive Firebase setup documentation:

- [Firebase Project Setup](../implementation/firebase-project-setup.md)
- [Environment Configuration](../implementation/environment-configuration.md)
- [Troubleshooting Guide](../implementation/troubleshooting.md)
