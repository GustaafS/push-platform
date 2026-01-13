# iOS App Registration in Firebase

This guide covers registering your iOS application in Firebase Console to enable Firebase Cloud Messaging for push notifications.

## Prerequisites

- Firebase project created (see [Firebase Project Setup](./firebase-project-setup.md))
- iOS app with a bundle identifier configured in Xcode
- Access to Apple Developer Portal (for verifying bundle ID)

## Understanding iOS Bundle Identifiers

A bundle identifier uniquely identifies your iOS application. It follows reverse DNS notation.

### Bundle Identifier Format

```
com.yourcompany.appname
```

### Examples

```
Development:  com.pushplatform.app.dev
Staging:      com.pushplatform.app.staging
Production:   com.pushplatform.app
```

### Important Notes

- Bundle ID is **case-sensitive** and **must match exactly** between:
  - Xcode project configuration
  - Apple Developer Portal
  - Firebase Console
- Bundle ID **cannot be changed** after app is published to App Store
- Use different bundle IDs for development/staging/production builds

## Finding Your Bundle Identifier

### Option 1: In Xcode

1. Open your iOS project in Xcode
2. Select your target in the project navigator
3. Go to the **General** tab
4. Find **Bundle Identifier** field
5. Copy the exact value (e.g., `com.pushplatform.app`)

### Option 2: In Apple Developer Portal

1. Navigate to [developer.apple.com](https://developer.apple.com)
2. Go to **Certificates, Identifiers & Profiles**
3. Select **Identifiers** from the sidebar
4. Find your app in the list
5. The bundle ID is shown in the identifier column

## Step 1: Register iOS App in Firebase Console

1. Navigate to [Firebase Console](https://console.firebase.google.com)
2. Select your Firebase project
3. Click the **gear icon** next to "Project Overview"
4. Select **Project Settings**
5. On the **General** tab, scroll to "Your apps" section
6. Click **"Add app"** and select the **iOS** platform icon

## Step 2: Configure iOS App Details

### App Registration Form

1. **iOS bundle ID** (required)
   - Enter your exact bundle identifier (e.g., `com.pushplatform.app`)
   - Must match your Xcode configuration exactly
   - Case-sensitive, no spaces

2. **App nickname** (optional but recommended)
   - Human-readable name for identifying this app
   - Example: "Push Platform iOS Production"
   - Helps distinguish between multiple apps in same project

3. **App Store ID** (optional)
   - Can be left blank initially
   - Can be added later after app is published to App Store
   - Not required for Firebase Cloud Messaging functionality

4. Click **"Register app"**

## Step 3: Download GoogleService-Info.plist

After registering the app:

1. Firebase will prompt you to **download GoogleService-Info.plist**
2. Click **"Download GoogleService-Info.plist"**
3. **IMPORTANT:** Store this file securely
   - DO NOT commit to version control
   - Already added to .gitignore in this project
   - Contains sensitive Firebase configuration

### GoogleService-Info.plist Contents

The plist file contains:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>GOOGLE_APP_ID</key>
    <string>1:123456789:ios:abc123def456</string>
    <key>BUNDLE_ID</key>
    <string>com.pushplatform.app</string>
    <key>PROJECT_ID</key>
    <string>push-platform-prod-abc123</string>
    <key>GCM_SENDER_ID</key>
    <string>123456789</string>
    ...
</dict>
</plist>
```

### Key Fields to Note

- **GOOGLE_APP_ID**: Unique identifier for this iOS app in Firebase
- **BUNDLE_ID**: Your iOS bundle identifier
- **PROJECT_ID**: Your Firebase project ID
- **GCM_SENDER_ID**: Used for push notification registration

## Step 4: Store GoogleService-Info.plist Securely

### For Development

```bash
# Store in a secure location outside version control
mkdir -p ~/firebase-configs/push-platform
cp ~/Downloads/GoogleService-Info.plist ~/firebase-configs/push-platform/
```

### For Production

Use secure secret management:

- **AWS Secrets Manager**: Store as secret value
- **Google Cloud Secret Manager**: Store as secret
- **HashiCorp Vault**: Store as KV secret
- **1Password/LastPass**: Store in secure team vault

### In iOS Project

The GoogleService-Info.plist is needed for iOS client app (not the backend):

1. Add to iOS project in Xcode
2. Ensure it's included in app target
3. Do NOT add to git repository

**Note:** This backend Push Platform doesn't need the GoogleService-Info.plist file. It's only needed for the iOS client application that will receive notifications.

## Step 5: Extract Firebase App ID

You can use the provided script to extract configuration from GoogleService-Info.plist:

```bash
# Extract Firebase App ID and other config
pnpm --filter api run extract-app-id /path/to/GoogleService-Info.plist
```

The script will display:

```
Firebase App Configuration
==========================
Firebase App ID: 1:123456789:ios:abc123def456
Bundle ID: com.pushplatform.app
Project ID: push-platform-prod-abc123
GCM Sender ID: 123456789
```

## Step 6: Verify iOS App Registration

1. In Firebase Console, go to **Project Settings > General**
2. Scroll to "Your apps" section
3. Verify your iOS app is listed with:
   - Correct bundle identifier
   - App nickname (if provided)
   - Platform icon shows iOS

## Multi-Environment Setup

### Recommended Approach

Use **separate Firebase projects** for different environments:

| Environment | Firebase Project | Bundle ID |
|------------|------------------|-----------|
| Development | `push-platform-dev` | `com.pushplatform.app.dev` |
| Staging | `push-platform-staging` | `com.pushplatform.app.staging` |
| Production | `push-platform-prod` | `com.pushplatform.app` |

### Benefits

- Isolated notification testing
- Prevents accidental production notifications during development
- Independent APNs certificate management
- Clear separation of concerns

### Alternative: Single Project, Multiple Apps

You can register multiple apps in one Firebase project:

1. Register `com.pushplatform.app.dev` as one iOS app
2. Register `com.pushplatform.app.staging` as another iOS app
3. Register `com.pushplatform.app` as production iOS app

Each app gets its own GoogleService-Info.plist with different `GOOGLE_APP_ID`.

## Troubleshooting

### Issue: "Bundle ID already exists"

**Cause:** Bundle ID is already registered in this Firebase project

**Solution:**
- Check if app was already registered in "Your apps" section
- Use a different bundle ID if testing
- Delete existing app registration if it was a mistake

### Issue: "Invalid Bundle ID format"

**Cause:** Bundle ID doesn't follow reverse DNS notation

**Solution:**
- Use format: `com.company.appname`
- No spaces, special characters (except dots), or uppercase in company/app parts
- Can use hyphens: `com.my-company.my-app`

### Issue: "Cannot download GoogleService-Info.plist again"

**Cause:** Download button only appears once during initial setup

**Solution:**
- Go to Project Settings > General > Your apps
- Find your iOS app
- Click the **gear icon** next to the app
- Select **"Download GoogleService-Info.plist"**

### Issue: "GoogleService-Info.plist missing keys"

**Cause:** File was manually edited or corrupted

**Solution:**
- Re-download from Firebase Console
- Do not manually edit the plist file
- If corruption persists, unregister and re-register the iOS app

## Security Best Practices

1. **Never Commit to Git**
   - GoogleService-Info.plist is already in .gitignore
   - Contains API keys and identifiers
   - Can be used to impersonate your app

2. **Use Different Configs per Environment**
   - Development: `GoogleService-Info-dev.plist`
   - Staging: `GoogleService-Info-staging.plist`
   - Production: `GoogleService-Info.plist`

3. **Restrict Firebase Console Access**
   - Limit who can download configuration files
   - Use Firebase IAM roles appropriately
   - Audit access logs regularly

4. **Monitor App Registration**
   - Review registered apps monthly
   - Remove unused app registrations
   - Update team documentation when apps are added

## iOS Client Integration

### Adding GoogleService-Info.plist to iOS Project

1. In Xcode, right-click project navigator
2. Select **"Add Files to [Your Project]"**
3. Navigate to GoogleService-Info.plist location
4. Ensure **"Copy items if needed"** is checked
5. Select your app target
6. Click **"Add"**

### Verify Installation

The plist should appear in:
- Project navigator
- Target > Build Phases > Copy Bundle Resources

### Initialize Firebase in iOS App

```swift
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        return true
    }
}
```

## Next Steps

After completing iOS app registration:

1. [Create APNs authentication key](./apns-key-setup.md)
2. [Upload APNs key to Firebase](./apns-key-setup.md#upload-to-firebase)
3. [Generate service account credentials](./service-account-setup.md)
4. [Configure environment variables](./environment-configuration.md)

## Additional Resources

- [Firebase iOS Setup Guide](https://firebase.google.com/docs/ios/setup)
- [Apple Developer Portal](https://developer.apple.com)
- [Bundle ID Documentation](https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleidentifier)
- [Firebase Cloud Messaging for iOS](https://firebase.google.com/docs/cloud-messaging/ios/client)
