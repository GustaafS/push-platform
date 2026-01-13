# Firebase Push Notifications Troubleshooting Guide

This guide covers common issues and solutions for Firebase Cloud Messaging integration in the Push Platform.

## Quick Diagnosis

Run validation scripts to identify issues:

```bash
# Validate all environment variables
pnpm --filter api run validate-env

# Validate Firebase configuration
pnpm --filter api run validate-firebase

# Validate service account
pnpm --filter api run validate-service-account /path/to/firebase-credentials.json
```

## Configuration Issues

### Error: "Firebase configuration not found"

**Symptoms:**
- API or worker fails to start
- Error message: "Firebase configuration not found for application X"

**Causes:**
- Missing environment variables
- Incorrect NODE_ENV setting
- No per-app config and no global fallback

**Solutions:**

**For Development:**
```bash
# Ensure these are set in .env
NODE_ENV=development
FIREBASE_PROJECT_ID=your-firebase-project-id
```

**For Production:**
```bash
# Set one of these:
SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# OR
FIREBASE_CREDENTIALS_PATH=/path/to/firebase-credentials.json
```

**Verify:**
```bash
pnpm --filter api run validate-env
```

---

### Error: "Invalid service account JSON"

**Symptoms:**
- Firebase authentication fails
- Error during startup or first push attempt

**Causes:**
- Malformed JSON
- Missing required fields
- Incorrect encoding (for base64 approach)

**Solutions:**

1. **Validate JSON structure:**
```bash
pnpm --filter api run validate-service-account /path/to/firebase-credentials.json
```

2. **Check required fields:**
```bash
cat firebase-credentials.json | jq 'keys'
# Should include: type, project_id, private_key, client_email, client_id
```

3. **Re-encode for environment variable:**
```bash
pnpm --filter api run json-to-base64 /path/to/firebase-credentials.json
```

4. **Re-download from Firebase Console** if file is corrupted

---

### Error: "Project ID mismatch"

**Symptoms:**
- Authentication works but push fails
- Error: "Requested entity was not found"

**Causes:**
- Service account from different Firebase project
- FIREBASE_PROJECT_ID doesn't match service account
- Per-app config uses wrong Firebase project

**Solutions:**

1. **Verify project IDs match:**
```bash
# Check environment variable
echo $FIREBASE_PROJECT_ID

# Check service account
cat firebase-credentials.json | jq -r '.project_id'
```

2. **For per-app configs:**
```sql
-- Check which Firebase project each app uses
SELECT
  slug,
  firebase_config->>'project_id' as firebase_project
FROM applications;
```

3. **Ensure consistency:**
- iOS app registered in correct Firebase project
- APNs key uploaded to correct Firebase project
- Service account from correct Firebase project

---

## APNs Configuration Issues

### Error: "APNs certificate not configured"

**Symptoms:**
- Push notifications fail to send
- FCM error about APNs configuration

**Causes:**
- APNs key not uploaded to Firebase Console
- APNs key expired or revoked
- Wrong Key ID or Team ID

**Solutions:**

1. **Verify APNs configuration in Firebase Console:**
   - Go to Project Settings > Cloud Messaging
   - Check iOS app configuration
   - Status should show "APNs certificate configured"

2. **Re-upload APNs key:**
   - See [APNs Key Setup Guide](./apns-key-setup.md)
   - Use validation script first:
   ```bash
   pnpm --filter api run validate-apns /path/to/AuthKey_ABC123.p8
   ```

3. **Verify Key ID and Team ID:**
   - Must be exactly 10 characters
   - Check in Apple Developer Portal under Keys and Membership

---

### Error: "messaging/invalid-apns-credential"

**Symptoms:**
- Push fails with APNs credential error
- Works in Firebase Console test but not via API

**Causes:**
- APNs key not properly configured
- Bundle ID mismatch
- Wrong APNs environment (development vs production)

**Solutions:**

1. **Check bundle ID consistency:**
```sql
-- Verify device tokens are from correct app
SELECT platform, COUNT(*) FROM devices GROUP BY platform;
```

2. **Verify iOS app bundle ID:**
   - iOS app Info.plist bundle identifier
   - Firebase Console > Project Settings > General > iOS app
   - Should match exactly (case-sensitive)

3. **Check APNs environment:**
   - Development builds need development APNs certificates
   - Production builds need production APNs certificates
   - APNs .p8 key works for both environments

---

## Device Token Issues

### Error: "messaging/invalid-registration-token"

**Symptoms:**
- Push fails for specific devices
- Error in worker logs
- Device automatically marked as invalid

**Causes:**
- FCM token expired
- Device uninstalled app
- Token from different Firebase project
- iOS app re-installed without re-registering

**Solutions:**

1. **This is expected behavior** - Platform handles it automatically:
   - Device is marked `isValid = false` in database
   - Future pushes skip this device
   - iOS app should re-register on next launch

2. **Force device re-registration:**
   - iOS app should call registration API on every launch
   - Update existing device record with fresh token

3. **Clean up invalid devices:**
```sql
-- View invalid devices
SELECT * FROM devices WHERE is_valid = false;

-- Delete old invalid devices
DELETE FROM devices
WHERE is_valid = false
AND updated_at < NOW() - INTERVAL '30 days';
```

---

### Error: "messaging/registration-token-not-registered"

**Symptoms:**
- Device never receives notifications
- Token appears valid but FCM rejects it

**Causes:**
- Token from wrong Firebase project
- iOS app not properly initialized with Firebase
- GoogleService-Info.plist mismatch

**Solutions:**

1. **Verify Firebase project consistency:**
   - Backend service account project ID
   - iOS app GoogleService-Info.plist project ID
   - Should be the same Firebase project

2. **Check iOS app Firebase initialization:**
```swift
import FirebaseCore

FirebaseApp.configure()  // Must be called in AppDelegate
```

3. **Re-download GoogleService-Info.plist:**
   - From correct Firebase project
   - Add to iOS project in Xcode
   - Ensure included in app target

---

## Worker Processing Issues

### Worker not processing deliveries

**Symptoms:**
- Deliveries stuck in "queued" status
- No activity in worker logs

**Causes:**
- Worker not running
- Database connection failed
- Environment variables not set
- Worker polling disabled

**Solutions:**

1. **Verify worker is running:**
```bash
# Check process
docker ps | grep worker
# OR
ps aux | grep worker

# Check logs
docker logs push-platform-worker -f
# OR
pnpm --filter worker dev
```

2. **Check database connection:**
```bash
# Test from worker container
docker exec push-platform-worker env | grep DATABASE_URL

# Verify connection string
pnpm --filter api run validate-env
```

3. **Review worker configuration:**
```bash
# Check worker environment
WORKER_POLL_INTERVAL_MS=10000  # 10 seconds
WORKER_BATCH_SIZE=100
MAX_RETRY_COUNT=5
```

4. **Check queued deliveries:**
```sql
SELECT
  COUNT(*) as queued_count,
  MIN(created_at) as oldest
FROM push_deliveries
WHERE status = 'queued';
```

---

### Deliveries stuck in "sending" status

**Symptoms:**
- Status never updates to "sent" or "failed"
- Worker logs show "Processing" but no completion

**Causes:**
- Worker crashed mid-processing
- Long-running FCM API calls
- Database transaction not committed

**Solutions:**

1. **Identify stuck deliveries:**
```sql
SELECT * FROM push_deliveries
WHERE status = 'sending'
AND updated_at < NOW() - INTERVAL '5 minutes';
```

2. **Reset to queued:**
```sql
UPDATE push_deliveries
SET status = 'queued', retry_count = retry_count + 1
WHERE status = 'sending'
AND updated_at < NOW() - INTERVAL '5 minutes';
```

3. **Restart worker:**
```bash
docker restart push-platform-worker
# OR
# Stop and start worker process
```

---

### High retry count but still failing

**Symptoms:**
- Deliveries reach MAX_RETRY_COUNT
- Still marked as failed
- Same error repeats

**Causes:**
- Persistent configuration issue
- Invalid credentials
- FCM API quota exceeded
- Network connectivity problem

**Solutions:**

1. **Check error messages:**
```sql
SELECT
  error_message,
  COUNT(*) as count
FROM push_deliveries
WHERE status = 'failed'
AND retry_count >= 5
GROUP BY error_message
ORDER BY count DESC;
```

2. **For authentication errors:**
   - Verify SERVICE_ACCOUNT_JSON is correct
   - Check service account has Firebase Messaging permissions
   - Validate with: `pnpm --filter api run validate-firebase`

3. **For quota errors:**
   - Check Firebase Console > Usage and billing
   - Verify Blaze plan is active
   - Review quota limits

4. **For network errors:**
   - Check worker has internet connectivity
   - Verify firewall allows outbound HTTPS
   - Test: `curl -I https://fcm.googleapis.com`

---

## Authentication Issues

### Error: "Permission denied" from Firebase

**Symptoms:**
- Authentication succeeds but API calls fail
- Error: "Permission denied" or "Forbidden"

**Causes:**
- Service account lacks necessary permissions
- Service account key revoked
- Firebase API not enabled

**Solutions:**

1. **Verify service account role:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - IAM & Admin > IAM
   - Find service account email
   - Should have "Editor" or "Firebase Cloud Messaging Admin" role

2. **Check Firebase APIs enabled:**
   - Google Cloud Console > APIs & Services > Library
   - Search "Firebase Cloud Messaging API"
   - Should show as "Enabled"

3. **Generate new service account key:**
   - Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Update environment variable

---

### Error: "Invalid credentials" on startup

**Symptoms:**
- Application fails to start
- Error during Firebase Admin SDK initialization

**Causes:**
- Base64 encoding error
- JSON parsing error
- File path incorrect

**Solutions:**

1. **For SERVICE_ACCOUNT_JSON (base64):**
```bash
# Re-encode correctly
pnpm --filter api run json-to-base64 /path/to/firebase-credentials.json

# Test decoding
echo "$SERVICE_ACCOUNT_JSON" | base64 -d | jq '.'
```

2. **For FIREBASE_CREDENTIALS_PATH:**
```bash
# Verify file exists and is readable
test -f "$FIREBASE_CREDENTIALS_PATH" && echo "File exists" || echo "File not found"
test -r "$FIREBASE_CREDENTIALS_PATH" && echo "File readable" || echo "File not readable"

# Validate JSON
cat "$FIREBASE_CREDENTIALS_PATH" | jq '.'
```

---

## Multi-Application Issues

### Wrong Firebase project used for application

**Symptoms:**
- Push fails with "invalid token" for specific app
- Worker logs show unexpected project ID

**Causes:**
- Per-app firebaseConfig not set correctly
- Application using wrong global fallback

**Solutions:**

1. **Check application's Firebase config:**
```sql
SELECT
  slug,
  firebase_config->>'project_id' as firebase_project
FROM applications
WHERE slug = 'your-app-slug';
```

2. **Verify in worker logs:**
```
[Worker] Application: your-app-slug
[Worker] Using Firebase project: expected-project-id
```

3. **Update if incorrect:**
```bash
pnpm --filter api run add-app-firebase-config
```

---

### Multiple apps interfering with each other

**Symptoms:**
- Notifications sent to wrong app's devices
- Cross-contamination of push data

**Causes:**
- Applications sharing same Firebase project incorrectly
- Device tokens registered to wrong application

**Solutions:**

1. **Verify application isolation:**
```sql
-- Check device tokens per application
SELECT a.slug, COUNT(d.id) as device_count
FROM applications a
LEFT JOIN devices d ON a.id = d.application_id
GROUP BY a.slug;
```

2. **Ensure separate Firebase projects:**
   - Each iOS app should have unique bundle ID
   - Each bundle ID registered in separate Firebase project
   - Each application has its own firebaseConfig

3. **Review device registration:**
```sql
-- Find devices registered to wrong app
SELECT * FROM devices
WHERE application_id != (
  SELECT id FROM applications WHERE slug = 'expected-app'
);
```

---

## Network and Connectivity

### Error: "Network timeout" or "ECONNREFUSED"

**Symptoms:**
- FCM API calls timeout
- Worker can't reach Firebase

**Causes:**
- No internet connectivity
- Firewall blocking outbound HTTPS
- DNS resolution failure

**Solutions:**

1. **Test connectivity:**
```bash
# From worker container or server
curl -I https://fcm.googleapis.com
curl -I https://firebase.google.com

# Check DNS
nslookup fcm.googleapis.com
```

2. **Check firewall rules:**
   - Allow outbound HTTPS (port 443)
   - Allow connections to *.googleapis.com
   - Allow connections to firebase.google.com

3. **Verify proxy settings (if applicable):**
```bash
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

---

## Performance Issues

### Slow push notification delivery

**Symptoms:**
- Long delay between API call and device receiving notification
- Worker processes deliveries slowly

**Causes:**
- Large batch size overwhelming worker
- Database connection slow
- FCM API latency
- Too many retries

**Solutions:**

1. **Optimize worker configuration:**
```bash
# Reduce batch size for faster processing
WORKER_BATCH_SIZE=50

# Reduce poll interval for quicker pickup
WORKER_POLL_INTERVAL_MS=5000
```

2. **Check database performance:**
```sql
-- Index on deliveries status and nextRetryAt
CREATE INDEX IF NOT EXISTS idx_deliveries_processing
ON push_deliveries (status, next_retry_at)
WHERE status IN ('queued', 'sending');
```

3. **Monitor FCM API latency:**
   - Check Firebase Console > Usage
   - Review API response times in logs

4. **Scale worker horizontally:**
   - Run multiple worker instances
   - Each processes different batches
   - Ensure proper locking/coordination

---

### High memory usage in worker

**Symptoms:**
- Worker memory grows over time
- Out of memory errors

**Causes:**
- Firebase app instances not cleaned up
- Large batch processing
- Memory leak in application code

**Solutions:**

1. **Verify FirebaseRegistry cleanup:**
   - Ensure `cleanup()` called on graceful shutdown
   - Review `packages/shared/src/firebase/registry.ts`

2. **Reduce batch size:**
```bash
WORKER_BATCH_SIZE=50  # Reduce from default 100
```

3. **Monitor memory:**
```bash
# Docker
docker stats push-platform-worker

# PM2
pm2 monit
```

4. **Restart worker periodically:**
   - Add health check and auto-restart
   - Clear Firebase app cache

---

## Data Consistency Issues

### Duplicate push notifications sent

**Symptoms:**
- Users receive same notification multiple times
- Deliveries processed twice

**Causes:**
- Multiple worker instances without coordination
- Worker restarted mid-processing
- Database transaction rollback

**Solutions:**

1. **Implement idempotency:**
   - Already implemented via delivery status checks
   - Worker should only process `queued` status

2. **Add distributed locking (advanced):**
```sql
-- Use PostgreSQL advisory locks
SELECT pg_try_advisory_lock(id::integer::bigint)
FROM push_deliveries
WHERE status = 'queued'
LIMIT 1;
```

3. **Review worker deployment:**
   - If running multiple workers, ensure proper coordination
   - Consider using job queue (Bull, BullMQ) for better distribution

---

## Debugging Tools

### Enable verbose logging

```bash
# For worker
LOG_LEVEL=debug pnpm --filter worker dev

# For API
LOG_LEVEL=debug pnpm --filter api dev
```

### Useful SQL queries

```sql
-- Delivery status summary
SELECT status, COUNT(*) FROM push_deliveries GROUP BY status;

-- Recent failures
SELECT * FROM push_deliveries
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 10;

-- Deliveries pending retry
SELECT * FROM push_deliveries
WHERE status = 'queued'
AND retry_count > 0
ORDER BY next_retry_at;

-- Top error messages
SELECT error_message, COUNT(*)
FROM push_deliveries
WHERE error_message IS NOT NULL
GROUP BY error_message
ORDER BY COUNT(*) DESC;
```

### Firebase Console checks

1. **Usage dashboard:** Project Settings > Usage and billing
2. **Cloud Messaging logs:** Cloud Messaging tab
3. **Service accounts:** Project Settings > Service Accounts
4. **iOS app config:** Project Settings > General

---

## Getting Help

If issues persist after trying these solutions:

1. **Check Firebase Status:** https://status.firebase.google.com
2. **Review documentation:**
   - [Environment Configuration](./environment-configuration.md)
   - [Service Account Setup](./service-account-setup.md)
   - [Testing Guide](./testing-guide.md)
3. **Enable debug logging** and collect logs
4. **Run validation scripts** and save output
5. **Contact Firebase Support** for Firebase-specific issues

### Information to gather:

- Validation script output
- Worker logs (last 100 lines)
- Database query results (delivery status, error messages)
- Firebase Console screenshots (APNs config, service accounts)
- Environment variables (redact sensitive values)

---

## Preventive Measures

### Regular maintenance

1. **Rotate service account keys every 90 days**
2. **Clean up invalid devices monthly**
3. **Monitor delivery success rate**
4. **Review error logs weekly**
5. **Update Firebase dependencies**

### Monitoring setup

1. **Alert on high failure rate** (>10% failed deliveries)
2. **Alert on worker not processing** (deliveries queued >5 min)
3. **Track FCM API latency**
4. **Monitor database connection pool**

### Documentation

1. **Document Firebase project details** (project ID, creation date)
2. **Track APNs key rotation dates**
3. **Maintain runbook** for common issues
4. **Update troubleshooting guide** with new issues
