# Firebase Setup Deployment Checklist

This checklist ensures all Firebase configuration steps are completed for production deployment.

## Pre-Deployment Checklist

### Firebase Console Setup

- [ ] **Firebase Project Created**
  - [ ] Project name follows naming convention (e.g., `push-platform-prod`)
  - [ ] Project ID documented and saved securely
  - [ ] Blaze (pay-as-you-go) billing plan enabled
  - [ ] Billing alerts configured ($10, $50, $100 thresholds)
  - [ ] Project region set (if applicable)

- [ ] **Cloud Messaging Enabled**
  - [ ] Cloud Messaging tab accessible in Firebase Console
  - [ ] No errors or warnings displayed
  - [ ] FCM API confirmed enabled

### iOS App Registration

- [ ] **iOS App Registered in Firebase**
  - [ ] iOS bundle identifier matches Xcode project exactly
  - [ ] App nickname set (e.g., "Push Platform iOS Production")
  - [ ] GoogleService-Info.plist downloaded
  - [ ] GoogleService-Info.plist stored securely (NOT in git)
  - [ ] Firebase App ID extracted and documented

- [ ] **Bundle ID Verification**
  - [ ] Bundle ID matches between:
    - [ ] Xcode project settings
    - [ ] Apple Developer Portal identifier
    - [ ] Firebase Console iOS app registration
  - [ ] Bundle ID follows naming convention for environment

### Apple Developer Portal Setup

- [ ] **APNs Authentication Key Created**
  - [ ] Key created in Apple Developer Portal > Keys
  - [ ] Key name documented (e.g., "Push Platform FCM APNs Key 2026-01")
  - [ ] .p8 file downloaded (WARNING: one-time only!)
  - [ ] .p8 file stored in secure location(s)
  - [ ] Key ID (10 characters) documented
  - [ ] Team ID (10 characters) documented
  - [ ] APNs service enabled for the key

- [ ] **APNs Key Uploaded to Firebase**
  - [ ] Navigate to Firebase Console > Cloud Messaging
  - [ ] .p8 file uploaded successfully
  - [ ] Key ID entered correctly
  - [ ] Team ID entered correctly
  - [ ] Status shows "APNs certificate configured" with green checkmark

### Service Account Setup

- [ ] **Firebase Service Account Generated**
  - [ ] Service account key generated from Firebase Console
  - [ ] JSON file downloaded
  - [ ] JSON file renamed to `firebase-credentials.json`
  - [ ] JSON file stored securely (NOT in git)
  - [ ] All required fields present (type, project_id, private_key, client_email, client_id)
  - [ ] Service account validated using script

- [ ] **Service Account Permissions**
  - [ ] Service account has appropriate role (Editor or Firebase Cloud Messaging Admin)
  - [ ] Verified in Google Cloud Console > IAM & Admin
  - [ ] Access audit log reviewed

### Environment Configuration

- [ ] **Production Environment Variables Set**
  - [ ] `NODE_ENV=production`
  - [ ] `SERVICE_ACCOUNT_JSON` OR `FIREBASE_CREDENTIALS_PATH` configured
  - [ ] `DATABASE_URL` configured correctly
  - [ ] `API_KEYS` set with strong, unique keys
  - [ ] `WORKER_POLL_INTERVAL_MS` configured (default: 10000)
  - [ ] `WORKER_BATCH_SIZE` configured (default: 100)
  - [ ] `MAX_RETRY_COUNT` configured (default: 5)

- [ ] **Secret Management**
  - [ ] Service account stored in secret manager (AWS Secrets Manager, etc.)
  - [ ] API keys stored in secret manager
  - [ ] Database credentials stored in secret manager
  - [ ] Secrets access properly restricted

### Validation

- [ ] **Configuration Validated**
  - [ ] `pnpm --filter api run validate-env` passes
  - [ ] `pnpm --filter api run validate-firebase` passes
  - [ ] `pnpm --filter api run validate-service-account` passes
  - [ ] No errors in validation output

- [ ] **Firebase Connectivity Tested**
  - [ ] Firebase Admin SDK initializes successfully
  - [ ] Messaging service accessible
  - [ ] No authentication errors in logs

## Deployment Steps

### Database Setup

- [ ] **Database Prepared**
  - [ ] PostgreSQL database created
  - [ ] Database migrations run: `pnpm migrate`
  - [ ] Database connection tested from application
  - [ ] Sample application created (if needed): `pnpm --filter api run seed-data`

### Application Deployment

- [ ] **API Service Deployed**
  - [ ] Docker image built or code deployed
  - [ ] Environment variables set in deployment platform
  - [ ] Health check endpoint responding
  - [ ] Logs show successful startup
  - [ ] No Firebase configuration errors

- [ ] **Worker Service Deployed**
  - [ ] Docker image built or code deployed
  - [ ] Environment variables set in deployment platform
  - [ ] Worker polling and processing deliveries
  - [ ] Logs show successful Firebase initialization
  - [ ] No database connection errors

### Multi-Application Setup (if applicable)

- [ ] **Per-Application Configs (if needed)**
  - [ ] Applications requiring dedicated Firebase identified
  - [ ] Firebase projects created for each
  - [ ] Service accounts generated for each
  - [ ] Configs added using: `pnpm --filter api run add-app-firebase-config`
  - [ ] Configs verified: `pnpm --filter api run list-firebase-configs`

## Post-Deployment Testing

### Functional Testing

- [ ] **Test Notification via Firebase Console**
  - [ ] Navigate to Firebase Console > Cloud Messaging
  - [ ] Send test message with device FCM token
  - [ ] Notification received on iOS device
  - [ ] No errors in Firebase Console

- [ ] **Test Device Registration**
  - [ ] iOS app successfully registers FCM token
  - [ ] Device appears in database (devices table)
  - [ ] Device isValid = true
  - [ ] Device token matches iOS app token

- [ ] **Test Push Notification via API**
  - [ ] POST to `/v1/{appSlug}/push` succeeds
  - [ ] Message created in push_messages table
  - [ ] Delivery created in push_deliveries table
  - [ ] Worker picks up and processes delivery
  - [ ] Delivery status changes to "sent"
  - [ ] Notification received on iOS device
  - [ ] FCM message ID logged

- [ ] **Test Invalid Token Handling**
  - [ ] Send push to invalid/expired token
  - [ ] Worker logs "invalid-registration-token" error
  - [ ] Device marked as isValid = false in database
  - [ ] Delivery marked as failed
  - [ ] No application crash

- [ ] **Test Retry Logic**
  - [ ] Simulate transient error (temporary network issue)
  - [ ] Delivery marked for retry with exponential backoff
  - [ ] Retry succeeds after error resolved
  - [ ] Delivery eventually marked as sent

### Performance Testing

- [ ] **Load Testing**
  - [ ] Send 100+ notifications concurrently
  - [ ] All deliveries processed within reasonable time
  - [ ] No worker crashes or errors
  - [ ] Database performance acceptable
  - [ ] Memory usage remains stable

- [ ] **Worker Performance**
  - [ ] Worker processes batches efficiently
  - [ ] Poll interval working as configured
  - [ ] No delivery processing delays
  - [ ] Logs show healthy processing rate

### Multi-Tenant Testing (if applicable)

- [ ] **Application Isolation**
  - [ ] Send notifications for multiple applications
  - [ ] Each uses correct Firebase project (check logs)
  - [ ] No cross-contamination between applications
  - [ ] Correct bundle ID and project ID in FCM messages

## Monitoring Setup

- [ ] **Logging**
  - [ ] Worker logs accessible and searchable
  - [ ] API logs accessible and searchable
  - [ ] Log retention policy configured
  - [ ] Error log aggregation configured

- [ ] **Metrics**
  - [ ] Push delivery success rate tracked
  - [ ] Worker processing rate monitored
  - [ ] FCM API latency monitored
  - [ ] Database query performance monitored

- [ ] **Alerts**
  - [ ] Alert on high delivery failure rate (>10%)
  - [ ] Alert on worker not processing (deliveries queued >5 min)
  - [ ] Alert on Firebase authentication errors
  - [ ] Alert on database connection failures

- [ ] **Firebase Console Monitoring**
  - [ ] Usage dashboard reviewed
  - [ ] Message delivery metrics enabled
  - [ ] Billing alerts configured

## Security Checklist

- [ ] **Credentials Security**
  - [ ] firebase-credentials.json NOT in version control
  - [ ] .p8 APNs key file NOT in version control
  - [ ] GoogleService-Info.plist NOT in version control
  - [ ] .gitignore properly configured
  - [ ] No credentials in application logs
  - [ ] Environment variables not exposed publicly

- [ ] **Access Control**
  - [ ] Firebase Console access restricted to essential personnel
  - [ ] Apple Developer Portal access restricted
  - [ ] Database access restricted with proper authentication
  - [ ] API keys strong and unique
  - [ ] Secret manager access properly restricted

- [ ] **Credential Rotation Plan**
  - [ ] Service account rotation schedule documented (90 days)
  - [ ] APNs key rotation schedule documented (90 days)
  - [ ] API key rotation schedule documented
  - [ ] Rotation procedures documented
  - [ ] Calendar reminders set for rotations

## Documentation

- [ ] **Configuration Documented**
  - [ ] Firebase Project ID documented
  - [ ] Firebase Project name documented
  - [ ] APNs Key ID documented
  - [ ] APNs Team ID documented
  - [ ] Service account email documented
  - [ ] All creation dates documented

- [ ] **Runbook Created**
  - [ ] Common operations documented
  - [ ] Troubleshooting steps documented
  - [ ] Escalation procedures documented
  - [ ] On-call procedures defined

- [ ] **Team Training**
  - [ ] Team trained on Firebase setup
  - [ ] Team understands troubleshooting guide
  - [ ] Team knows how to rotate credentials
  - [ ] Team understands multi-app architecture (if applicable)

## Rollback Plan

- [ ] **Rollback Procedures**
  - [ ] Previous service account key retained (but expired in Firebase)
  - [ ] Database backup available
  - [ ] Previous deployment artifacts available
  - [ ] Rollback tested in staging environment

## Sign-Off

### Pre-Deployment

- [ ] **Development Team Lead:** _________________ Date: _______
- [ ] **DevOps Engineer:** _________________ Date: _______
- [ ] **Security Review:** _________________ Date: _______

### Post-Deployment

- [ ] **All tests passed:** _________________ Date: _______
- [ ] **Monitoring configured:** _________________ Date: _______
- [ ] **Production sign-off:** _________________ Date: _______

## Environment-Specific Checklists

### Development Environment

- [ ] FIREBASE_PROJECT_ID set (no service account needed)
- [ ] NODE_ENV=development
- [ ] Using development Firebase project
- [ ] Development APNs environment (if applicable)

### Staging Environment

- [ ] Separate Firebase project from production
- [ ] SERVICE_ACCOUNT_JSON or FIREBASE_CREDENTIALS_PATH set
- [ ] NODE_ENV=staging (or production)
- [ ] Production APNs environment
- [ ] Mirrors production configuration

### Production Environment

- [ ] Dedicated Firebase project
- [ ] SERVICE_ACCOUNT_JSON or FIREBASE_CREDENTIALS_PATH set
- [ ] NODE_ENV=production
- [ ] Production APNs environment
- [ ] Blaze billing plan active
- [ ] All security measures implemented

## Notes

Document any deviations from the standard setup or special considerations:

```
Date: ____________
Notes:


```

## References

- [Firebase Project Setup](./firebase-project-setup.md)
- [iOS App Registration](./ios-app-registration.md)
- [APNs Key Setup](./apns-key-setup.md)
- [Service Account Setup](./service-account-setup.md)
- [Environment Configuration](./environment-configuration.md)
- [Multi-App Configuration](./multi-app-configuration.md)
- [Testing Guide](./testing-guide.md)
- [Troubleshooting Guide](./troubleshooting.md)
