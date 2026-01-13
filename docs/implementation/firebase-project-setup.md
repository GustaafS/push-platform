# Firebase Project Setup Guide

This guide walks through creating and configuring a Firebase project for the Push Platform.

## Prerequisites

- Google account with Firebase Console access
- Admin access to create new Firebase projects
- Credit card for Blaze (pay-as-you-go) billing plan (required for production)

## Step 1: Create Firebase Project

1. Navigate to the [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** or select an existing project
3. Enter a project name (recommended naming convention):
   - Development: `push-platform-dev`
   - Staging: `push-platform-staging`
   - Production: `push-platform-prod`
4. Configure Google Analytics (optional - can be disabled for push notification use case)
5. Click **"Create project"** and wait for provisioning to complete

## Step 2: Note Your Firebase Project ID

1. Once the project is created, you'll be taken to the project overview
2. Click the **gear icon** next to "Project Overview" and select **"Project settings"**
3. On the General tab, find your **Project ID** (format: `push-platform-prod-abc123`)
4. **Copy this Project ID** - you'll need it for:
   - Development mode: `FIREBASE_PROJECT_ID` environment variable
   - Production mode: It will be in your service account JSON

### Example Project IDs

```
Development: push-platform-dev-a1b2c3
Staging: push-platform-staging-d4e5f6
Production: push-platform-prod-g7h8i9
```

## Step 3: Enable Firebase Cloud Messaging API

1. In Firebase Console, navigate to **Project Settings > Cloud Messaging** tab
2. Firebase Cloud Messaging API is **automatically enabled** for new projects
3. You should see the Cloud Messaging tab with sections for:
   - iOS app configuration
   - Android app configuration (not used in this implementation)
   - Cloud Messaging API (Legacy) - ignore this section

### Verification

- The Cloud Messaging tab should be accessible without errors
- You may see warnings about "Legacy server key" - these can be ignored as we use the newer service account authentication method

## Step 4: Configure Project Settings and Billing

### Project Region (Optional)

1. Navigate to **Project Settings > General**
2. Set your preferred Google Cloud region if applicable
3. This affects where your Firebase data is stored

### Enable Blaze (Pay-as-you-go) Plan

**Required for Production Usage**

1. Navigate to the **Spark (Free)** plan indicator in the left sidebar
2. Click **"Upgrade"**
3. Select the **Blaze (Pay-as-you-go)** plan
4. Enter billing information (credit card required)
5. Set billing alerts (recommended: alert at $10, $50, $100 thresholds)

### Free Tier Limits

Even on the Blaze plan, Firebase Cloud Messaging includes generous free tier limits:

- **10 million messages per month** (free)
- After free tier: $1 per million messages

For most use cases, Firebase Cloud Messaging costs remain zero or minimal.

## Step 5: Document Your Configuration

Create a secure document with the following information:

```
Project Name: push-platform-production
Project ID: push-platform-prod-abc123
Billing Plan: Blaze (Pay-as-you-go)
Region: us-central1
Created Date: 2026-01-12
Environment: Production
```

Store this information in your team's secure documentation system (not in version control).

## Troubleshooting Common Issues

### Issue: "Cannot create project"

**Cause:** Account limits or billing issues

**Solution:**
- Verify you're logged into the correct Google account
- Check that you haven't exceeded project limits (max 10-12 projects per account)
- Ensure billing is enabled on your Google Cloud account
- Try using a different Google account with Firebase access

### Issue: "Cloud Messaging tab not visible"

**Cause:** Firebase project initialization incomplete

**Solution:**
- Wait a few minutes for project setup to complete
- Refresh the Firebase Console page
- Navigate away and back to Project Settings
- Check Firebase Status page for any known issues

### Issue: "Billing upgrade fails"

**Cause:** Payment method issues or regional restrictions

**Solution:**
- Verify credit card information is correct
- Check that your region supports Firebase billing
- Try a different payment method
- Contact Firebase support for billing issues

### Issue: "Project ID conflicts with existing project"

**Cause:** Project ID must be globally unique

**Solution:**
- Firebase will automatically suggest an available Project ID
- If you want a specific name, add numbers or organization prefix
- Example: `yourcompany-push-platform-prod-123`

## Environment-Specific Setup

### Development Environment

- Use descriptive project name: `push-platform-dev`
- Free Spark plan is sufficient for development
- Can use Firebase emulator suite for local testing
- Set `FIREBASE_PROJECT_ID` environment variable

### Staging Environment

- Use separate project: `push-platform-staging`
- Blaze plan recommended for realistic testing
- Should mirror production configuration
- Use different service account keys from production

### Production Environment

- Use separate project: `push-platform-prod`
- Blaze plan required
- Enable billing alerts and monitoring
- Implement strict access controls
- Rotate service account keys every 90 days

## Security Best Practices

1. **Project Access Control**
   - Limit Firebase Console access to essential team members
   - Use role-based access control (RBAC)
   - Regular audit of project members

2. **Separate Projects by Environment**
   - Never share Firebase projects between dev/staging/prod
   - Prevents accidental data mixing or notification spam
   - Allows for independent testing and deployment

3. **Billing Alerts**
   - Set up multiple threshold alerts
   - Monitor usage regularly
   - Investigate unexpected usage spikes immediately

4. **Project Naming**
   - Use consistent naming conventions
   - Include organization name for shared Google accounts
   - Include environment identifier (dev/staging/prod)

## Next Steps

After completing Firebase project setup:

1. [Register iOS app in Firebase](./ios-app-registration.md)
2. [Create APNs authentication key](./apns-key-setup.md)
3. [Generate service account credentials](./service-account-setup.md)
4. [Configure environment variables](./environment-configuration.md)

## Additional Resources

- [Firebase Console](https://console.firebase.google.com)
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firebase Support](https://firebase.google.com/support)
