# Firebase Push Notification Testing Guide

This guide covers testing Firebase Cloud Messaging integration for the Push Platform.

## Prerequisites

- Firebase project configured with APNs key
- Service account credentials set up
- iOS app with FCM integrated
- Push Platform running (API + Worker)
- Test iOS device or simulator

## Testing Checklist

- [ ] Firebase configuration validated
- [ ] Service account authentication working
- [ ] APNs key uploaded and active
- [ ] iOS app registered with FCM token
- [ ] API endpoint accessible
- [ ] Worker polling and processing deliveries
- [ ] Push notifications delivered to device

## Test 1: Validate Firebase Configuration

### Validate Environment Variables

```bash
# Check all environment variables
pnpm --filter api run validate-env

# Check Firebase specifically
pnpm --filter api run validate-firebase
```

### Expected Output

```
✓ PASS: NODE_ENV: production
✓ PASS: SERVICE_ACCOUNT_JSON is valid
✓ PASS: Firebase connection successful
✓ PASS: Admin SDK initialized and messaging service accessible

Summary: 4 passed, 0 failed
```

### If Tests Fail

- Review [Environment Configuration](./environment-configuration.md)
- Check service account JSON is valid
- Verify Firebase project ID matches
- Ensure APNs key is uploaded

## Test 2: Send Test Notification via Firebase Console

Firebase Console provides a built-in test notification feature.

### Steps

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your Firebase project
3. Navigate to **Cloud Messaging** in left sidebar
4. Click **"Send your first message"** or **"New campaign"**
5. Select **"Firebase Notification messages"**
6. Fill in notification details:
   - **Notification title**: "Test Notification"
   - **Notification text**: "Testing FCM via Firebase Console"
7. Click **"Send test message"**
8. Enter your iOS device FCM token
9. Click **"Test"**

### Expected Result

- Notification appears on iOS device
- Confirms APNs integration is working
- Verifies Firebase project is configured correctly

### If Test Fails

- **No notification received:**
  - Verify APNs key is uploaded to Firebase
  - Check iOS app has notification permissions enabled
  - Confirm FCM token is current and valid
  - Check device is connected to internet

- **"Invalid token" error:**
  - FCM token may have expired
  - Re-register device to get new token
  - Ensure token is from correct Firebase project

## Test 3: Register Device via API

Devices must register their FCM tokens with the Push Platform.

### Register Device

```bash
# Register a new device
curl -X POST http://localhost:3000/v1/myapp/devices \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test-device-12345",
    "token": "your-fcm-token-from-ios-app",
    "platform": "ios",
    "appVersion": "1.0.0",
    "osVersion": "17.0"
  }'
```

### Expected Response

```json
{
  "success": true,
  "device": {
    "id": "uuid-here",
    "deviceId": "test-device-12345",
    "token": "your-fcm-token-from-ios-app",
    "platform": "ios",
    "isValid": true,
    "createdAt": "2026-01-12T10:30:00Z"
  }
}
```

### Verify in Database

```sql
SELECT * FROM devices WHERE device_id = 'test-device-12345';
```

## Test 4: Send Push Notification via API

Send a push notification using the REST API.

### Send to Specific Devices

```bash
curl -X POST http://localhost:3000/v1/myapp/push \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceTokens": ["your-fcm-token-from-ios-app"],
    "notification": {
      "title": "Hello from Push Platform",
      "body": "This is a test notification via API"
    },
    "data": {
      "custom_key": "custom_value",
      "action": "open_screen",
      "screen_id": "home"
    }
  }'
```

### Send to Topic

```bash
curl -X POST http://localhost:3000/v1/myapp/push \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "all-users",
    "notification": {
      "title": "Announcement",
      "body": "Important update for all users"
    }
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": {
    "id": "uuid-here",
    "title": "Hello from Push Platform",
    "body": "This is a test notification via API",
    "status": "queued",
    "createdAt": "2026-01-12T10:35:00Z"
  }
}
```

### Verify Message Created

```sql
SELECT * FROM push_messages ORDER BY created_at DESC LIMIT 1;
SELECT * FROM push_deliveries WHERE message_id = 'message-uuid-here';
```

## Test 5: Verify Worker Processing

The worker processes queued deliveries in the background.

### Check Worker Logs

```bash
# If running via pnpm
pnpm --filter worker dev

# Or check Docker logs
docker logs push-platform-worker -f
```

### Expected Log Output

```
[Worker] Polling for queued deliveries...
[Worker] Found 1 delivery to process
[Worker] Processing delivery: <uuid>
[Worker] Application: myapp
[Worker] Using Firebase project: push-platform-prod-abc123
[Worker] Sending to FCM token: <token>
[Worker] FCM message sent successfully
[Worker] Message ID: projects/push-platform-prod-abc123/messages/0:1234567890
[Worker] Delivery status updated: sent
```

### Verify Delivery Status

```sql
-- Check delivery was processed
SELECT
  d.id,
  d.status,
  d.sent_at,
  d.error_message,
  m.title
FROM push_deliveries d
JOIN push_messages m ON d.message_id = m.id
ORDER BY d.created_at DESC
LIMIT 10;
```

Expected status: `sent`

## Test 6: Test Invalid Token Handling

Verify the platform correctly handles expired or invalid FCM tokens.

### Send to Invalid Token

```bash
curl -X POST http://localhost:3000/v1/myapp/push \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceTokens": ["invalid-token-12345"],
    "notification": {
      "title": "Test Invalid Token",
      "body": "This should fail"
    }
  }'
```

### Expected Worker Behavior

```
[Worker] Processing delivery: <uuid>
[Worker] FCM error: messaging/invalid-registration-token
[Worker] Marking device token as invalid
[Worker] Device updated: isValid = false
[Worker] Delivery status updated: failed
```

### Verify Device Invalidated

```sql
SELECT * FROM devices WHERE token = 'invalid-token-12345';
-- is_valid should be false
```

## Test 7: Test Multi-Application Isolation

Verify different applications use their own Firebase configurations.

### Setup Multiple Applications

```sql
-- Check applications and their Firebase configs
SELECT
  slug,
  name,
  firebase_config->>'project_id' as firebase_project
FROM applications;
```

### Send Notifications to Different Apps

```bash
# App A
curl -X POST http://localhost:3000/v1/app-a/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "notification": {"title": "App A", "body": "Test"}}'

# App B
curl -X POST http://localhost:3000/v1/app-b/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "notification": {"title": "App B", "body": "Test"}}'
```

### Verify Correct Firebase Project Used

Check worker logs for each delivery:

```
[Worker] Application: app-a
[Worker] Using Firebase project: app-a-firebase-project

[Worker] Application: app-b
[Worker] Using Firebase project: app-b-firebase-project
```

## Test 8: Test Retry Logic

Verify the platform retries failed deliveries with exponential backoff.

### Simulate Transient Failure

Temporarily make Firebase unavailable:

```bash
# Option 1: Invalid service account (temporarily)
# Change one character in SERVICE_ACCOUNT_JSON

# Option 2: Network issue
# Disconnect from internet temporarily
```

### Send Notification

```bash
curl -X POST http://localhost:3000/v1/myapp/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"topic": "test", "notification": {"title": "Retry Test", "body": "Testing retries"}}'
```

### Expected Behavior

```
[Worker] Processing delivery: <uuid>
[Worker] FCM error: [network error]
[Worker] Delivery failed, scheduling retry
[Worker] Retry count: 1, next retry at: 2026-01-12T10:36:00Z
```

### Restore Firebase Access

Fix the temporary issue (restore service account, reconnect network).

### Verify Retry Success

```
[Worker] Processing delivery: <uuid> (retry 1)
[Worker] FCM message sent successfully
[Worker] Delivery status updated: sent
```

### Check Database

```sql
SELECT
  id,
  status,
  retry_count,
  next_retry_at,
  error_message
FROM push_deliveries
WHERE id = '<uuid>';
```

## Test 9: Load Testing

Test platform performance under load.

### Send Multiple Notifications

```bash
# Send 100 notifications
for i in {1..100}; do
  curl -X POST http://localhost:3000/v1/myapp/push \
    -H "X-API-Key: your-api-key" \
    -H "Content-Type: application/json" \
    -d "{\"topic\": \"test\", \"notification\": {\"title\": \"Notification $i\", \"body\": \"Load test\"}}" &
done
wait
```

### Monitor Worker Performance

```bash
# Watch worker logs
docker logs push-platform-worker -f

# Check processing rate
# Worker should process WORKER_BATCH_SIZE (default: 100) per poll
```

### Verify All Deliveries Processed

```sql
SELECT
  status,
  COUNT(*) as count
FROM push_deliveries
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY status;
```

Expected: Most or all should be `sent`.

## Test 10: End-to-End Flow

Complete flow from device registration to notification delivery.

### Step 1: Register Device

```bash
curl -X POST http://localhost:3000/v1/myapp/devices \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "e2e-test-device",
    "token": "your-real-fcm-token",
    "platform": "ios"
  }'
```

### Step 2: Send Notification

```bash
curl -X POST http://localhost:3000/v1/myapp/push \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceTokens": ["your-real-fcm-token"],
    "notification": {
      "title": "E2E Test",
      "body": "End-to-end test notification"
    },
    "data": {
      "test_id": "e2e-001"
    }
  }'
```

### Step 3: Verify Message Created

```sql
SELECT * FROM push_messages WHERE title = 'E2E Test';
```

### Step 4: Verify Delivery Queued

```sql
SELECT * FROM push_deliveries WHERE message_id = '<message-uuid>';
```

### Step 5: Watch Worker Process

Worker logs should show:
- Delivery picked up
- FCM message sent
- Delivery marked as sent

### Step 6: Verify Notification Received

Check iOS device:
- Notification appears in notification center
- Custom data accessible in app (if opened)

### Step 7: Verify Database Updated

```sql
SELECT
  m.title,
  m.body,
  d.status,
  d.sent_at,
  d.fcm_message_id
FROM push_deliveries d
JOIN push_messages m ON d.message_id = m.id
WHERE m.title = 'E2E Test';
```

Expected:
- `status`: `sent`
- `sent_at`: Recent timestamp
- `fcm_message_id`: Present

## Troubleshooting Test Failures

### Notifications Not Delivered

**Check:**
1. Worker is running: `docker ps` or `pnpm --filter worker dev`
2. Worker logs for errors
3. Device token is valid and current
4. APNs key is uploaded to Firebase
5. iOS app has notification permissions
6. Device is connected to internet

**Debug:**
```sql
-- Check delivery status
SELECT * FROM push_deliveries WHERE status = 'failed';

-- Check error messages
SELECT error_message, COUNT(*) FROM push_deliveries GROUP BY error_message;
```

### Worker Not Processing

**Check:**
1. `DATABASE_URL` is correct
2. `SERVICE_ACCOUNT_JSON` or `FIREBASE_CREDENTIALS_PATH` is set
3. Worker has database connection
4. No unhandled exceptions in worker logs

**Debug:**
```bash
# Test database connection
pnpm --filter api run validate-env

# Check queued deliveries
SELECT COUNT(*) FROM push_deliveries WHERE status = 'queued';
```

### Invalid Token Errors

**Cause:** FCM token expired or from wrong Firebase project

**Solution:**
1. Re-register device from iOS app
2. Verify iOS app uses same Firebase project as backend
3. Check APNs key is uploaded to correct Firebase project

## Performance Benchmarks

Expected performance (approximate):

- **API response time**: < 100ms for push endpoint
- **Worker processing**: 100 deliveries per batch (configurable)
- **Worker poll interval**: 10 seconds (configurable)
- **FCM latency**: 1-5 seconds to device
- **Database writes**: < 50ms per delivery

## Next Steps

After testing is complete:

1. Review [Troubleshooting Guide](./troubleshooting.md) for common issues
2. Set up monitoring and alerting
3. Configure production environment
4. Plan Firebase credential rotation schedule

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [FCM iOS Client Setup](https://firebase.google.com/docs/cloud-messaging/ios/client)
- [APNs Documentation](https://developer.apple.com/documentation/usernotifications)
