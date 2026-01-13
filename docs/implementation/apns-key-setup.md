# APNs Authentication Key Setup

This guide covers creating an APNs (Apple Push Notification service) authentication key in the Apple Developer Portal and configuring it in Firebase for push notifications.

## Prerequisites

- Apple Developer account with admin or account holder access
- iOS app registered in Firebase (see [iOS App Registration](./ios-app-registration.md))
- Access to Apple Developer Portal at [developer.apple.com](https://developer.apple.com)

## Understanding APNs Authentication

### APNs Authentication Methods

Apple supports two authentication methods for push notifications:

1. **Token-based (.p8 key)** - Recommended ✓
   - Single key works for all apps in your team
   - Does not expire
   - Simpler to manage
   - Used by Firebase Cloud Messaging

2. **Certificate-based (.p12)** - Legacy
   - Separate certificate per app
   - Expires annually (must renew)
   - More complex setup
   - Not recommended for new implementations

**This guide covers the token-based .p8 key method.**

## Important: .p8 Key File

- **Can only be downloaded ONCE** when first created
- Cannot be re-downloaded after creation
- If lost, must revoke and create new key
- Store securely immediately after download

## Step 1: Access Apple Developer Portal

1. Navigate to [developer.apple.com](https://developer.apple.com)
2. Sign in with your Apple ID
3. Go to **Account**
4. Select **Certificates, Identifiers & Profiles**

## Step 2: Create APNs Authentication Key

### Navigate to Keys Section

1. In the left sidebar, select **Keys**
2. Click the **+** button (or "Create a key" if no keys exist)

### Configure Key

1. **Key Name**
   - Enter a descriptive name
   - Example: "Push Platform FCM APNs Key"
   - Recommendation: Include purpose and date
   - Example: "FCM Production APNs 2026-01"

2. **Enable APNs Service**
   - Check the box for **Apple Push Notifications service (APNs)**
   - This is the only service needed for push notifications

3. **Review and Register**
   - Click **Continue**
   - Review the key details
   - Click **Register**

## Step 3: Download APNs Key File

### Critical: One-Time Download

After registration:

1. You'll see a confirmation page with:
   - **Key ID**: 10-character identifier (e.g., `ABC1234DEF`)
   - **Download** button

2. **IMMEDIATELY** do the following:
   - Click **Download** to get the `.p8` file
   - **Copy the Key ID** (you'll need this for Firebase)
   - Store both securely (see storage section below)

3. **WARNING**: Once you leave this page, you cannot download the `.p8` file again

### .p8 File Details

- **Filename format**: `AuthKey_ABC1234DEF.p8`
- **File type**: Text file containing the private key
- **Format**: PKCS#8 PEM format
- **Size**: Approximately 200-300 bytes

### Example .p8 File Content

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
[additional lines of encoded key data]
...xyz123==
-----END PRIVATE KEY-----
```

## Step 4: Retrieve Team ID

Your Team ID is required along with the Key ID for Firebase configuration.

### Option 1: From Membership Page

1. In Apple Developer Portal, select **Membership** from sidebar
2. Your **Team ID** is displayed (10-character identifier)
3. Example: `XYZ9876ABC`

### Option 2: From Xcode

1. Open your iOS project in Xcode
2. Select your project in the navigator
3. Select your target
4. Go to **Signing & Capabilities** tab
5. Team ID is shown next to the team name

## Step 5: Store APNs Key Securely

### DO NOT Commit to Git

The .p8 file is already excluded by .gitignore:

```gitignore
# Firebase Configuration Files
*.p8
```

### Recommended Storage Locations

#### For Development

```bash
# Create secure directory
mkdir -p ~/apns-keys/push-platform
chmod 700 ~/apns-keys/push-platform

# Move downloaded key
mv ~/Downloads/AuthKey_*.p8 ~/apns-keys/push-platform/
chmod 600 ~/apns-keys/push-platform/AuthKey_*.p8
```

#### For Production

Use enterprise secret management:

- **AWS Secrets Manager**: Store as secret binary
- **Google Cloud Secret Manager**: Store as secret
- **HashiCorp Vault**: Store in KV secrets engine
- **1Password/LastPass**: Store in team vault with key metadata
- **Azure Key Vault**: Store as secret

### Document Key Details

Create a secure record with:

```
APNs Key Details
================
Key Name: Push Platform FCM APNs Key
Key ID: ABC1234DEF
Team ID: XYZ9876ABC
Created: 2026-01-12
File: AuthKey_ABC1234DEF.p8
Environment: Production
Upload Status: Uploaded to Firebase on 2026-01-12
Notes: Shared key for all Push Platform apps
```

## Step 6: Upload APNs Key to Firebase

### Navigate to Firebase Cloud Messaging Settings

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your Firebase project
3. Click **gear icon** > **Project Settings**
4. Select **Cloud Messaging** tab
5. Scroll to **iOS app configuration** section

### Upload APNs Authentication Key

1. Find your iOS app in the list
2. Under "APNs Authentication Key" section, click **Upload**

3. Fill in the form:
   - **APNs Authentication Key**: Click to select your .p8 file
   - **Key ID**: Enter the 10-character Key ID (e.g., `ABC1234DEF`)
   - **Team ID**: Enter the 10-character Team ID (e.g., `XYZ9876ABC`)

4. Click **Upload**

### Verify Configuration

After upload:

- Status should change to **"APNs certificate configured"**
- Green checkmark indicates successful configuration
- You'll see the Key ID displayed (last 4 characters)

## Step 7: Validate APNs Key Format

Use the validation script to check key format before upload:

```bash
pnpm --filter api run validate-apns /path/to/AuthKey_ABC1234DEF.p8
```

The script validates:
- Key ID format (exactly 10 alphanumeric characters)
- Team ID format (exactly 10 alphanumeric characters)
- .p8 file format and structure
- File begins with `-----BEGIN PRIVATE KEY-----`
- File ends with `-----END PRIVATE KEY-----`

## APNs Key Management

### Key Rotation

**Recommended Schedule**: Every 90 days for production

#### Rotation Process

1. Create new APNs key in Apple Developer Portal
2. Download new .p8 file immediately
3. Upload new key to Firebase (replaces old key automatically)
4. Test push notifications with new key
5. Revoke old key in Apple Developer Portal
6. Update documentation with new Key ID

### Key Revocation

To revoke a compromised or old key:

1. Go to Apple Developer Portal > Keys
2. Find the key in the list
3. Click the key to view details
4. Click **Revoke** button
5. Confirm revocation

**WARNING**: Revoking a key immediately stops all push notifications using that key. Ensure new key is uploaded to Firebase first.

### Maximum Keys Limit

- Apple allows **maximum 2 APNs keys** per team
- If you hit the limit, revoke an old key before creating new one
- Plan key rotation carefully

## Multi-App Configuration

### Single Key for Multiple Apps

One APNs key can be used for **all apps** in your Apple Developer team:

- Same key for development, staging, and production apps
- Different bundle IDs but same APNs key
- Simplifies key management

### Example Configuration

| App Environment | Bundle ID | Firebase Project | APNs Key |
|----------------|-----------|------------------|----------|
| Development | `com.pushplatform.app.dev` | push-platform-dev | Same key |
| Staging | `com.pushplatform.app.staging` | push-platform-staging | Same key |
| Production | `com.pushplatform.app` | push-platform-prod | Same key |

Upload the same .p8 key to all three Firebase projects.

## Troubleshooting

### Issue: "Failed to upload APNs key"

**Cause:** Invalid Key ID, Team ID, or corrupted .p8 file

**Solution:**
- Verify Key ID is exactly 10 characters
- Verify Team ID is exactly 10 characters
- Ensure .p8 file is not corrupted
- Try downloading the .p8 file again if possible
- If file cannot be re-downloaded, create a new key

### Issue: "Key ID format is invalid"

**Cause:** Key ID must be exactly 10 alphanumeric characters

**Solution:**
- Copy Key ID exactly from Apple Developer Portal
- No spaces or special characters
- Example valid format: `ABC1234DEF`

### Issue: "Cannot download .p8 file again"

**Cause:** Apple only allows one-time download

**Solution:**
- If you didn't save the file: Create a new key (revoke old one first if at limit)
- For security reasons, Apple never stores private keys
- This is intentional security design

### Issue: "Push notifications not working after upload"

**Cause:** Configuration mismatch or propagation delay

**Solution:**
- Wait 5-10 minutes for Firebase to propagate configuration
- Verify bundle ID matches between iOS app, Firebase, and Apple Developer Portal
- Check Firebase Console shows "APNs certificate configured" status
- Send test notification from Firebase Console
- Check iOS device console logs for APNs registration errors

### Issue: "Maximum number of keys reached"

**Cause:** Already have 2 APNs keys (Apple's limit)

**Solution:**
- Review existing keys in Apple Developer Portal > Keys
- Identify keys that are no longer in use
- Revoke old/unused keys
- Then create new key

## Security Best Practices

### 1. Immediate Secure Storage

- Download .p8 file immediately upon creation
- Store in secure location before leaving the page
- Never email or share via insecure channels

### 2. Access Control

- Limit who can access .p8 files
- Use secret management systems with audit logs
- Implement role-based access control

### 3. Key Rotation

- Rotate keys every 90 days for production
- Document rotation schedule
- Test new keys before revoking old ones

### 4. Monitoring

- Monitor push notification delivery rates
- Alert on sudden drops (may indicate key issues)
- Track key usage and rotation dates

### 5. Backup Strategy

- Store .p8 files in multiple secure locations
- Document Key IDs and creation dates
- Maintain inventory of all active keys

## Next Steps

After completing APNs key setup:

1. [Generate Firebase service account credentials](./service-account-setup.md)
2. [Configure environment variables](./environment-configuration.md)
3. [Test push notifications](./testing-guide.md)

## Additional Resources

- [Apple Push Notification Service Documentation](https://developer.apple.com/documentation/usernotifications)
- [APNs Provider API](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server)
- [Firebase Cloud Messaging for iOS](https://firebase.google.com/docs/cloud-messaging/ios/client)
- [APNs Key Authentication](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/establishing_a_token-based_connection_to_apns)
