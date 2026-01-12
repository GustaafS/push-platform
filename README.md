# Push Platform

A production-ready, multi-tenant push notification platform built with Fastify, TypeScript, and Firebase Cloud Messaging (FCM).

## Features

- **Multi-tenant architecture**: Manage push notifications for multiple applications and tenants with isolated data
- **QR-code onboarding**: Simple device registration via QR code scanning
- **Async outbox pattern**: Reliable message delivery with automatic retries and error handling
- **Topic-based targeting**: Send notifications to groups of devices via topic subscriptions
- **Device-list targeting**: Send notifications to specific devices
- **Horizontal scaling**: Support for multiple API and worker instances
- **Type-safe**: Built with TypeScript in strict mode
- **Production-ready**: Docker support, structured logging, health checks

## Architecture

### Monorepo Structure

```
push-platform/
├── apps/
│   ├── api/          # Fastify REST API server
│   └── worker/       # Background worker for FCM delivery
├── packages/
│   ├── db/           # Database schema and migrations (Drizzle ORM)
│   └── shared/       # Shared types, utilities, and Firebase registry
└── docker/           # Docker configurations
```

### Tech Stack

- **API Framework**: Fastify with TypeBox for type-safe validation
- **Database**: PostgreSQL with Drizzle ORM
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Package Manager**: pnpm workspaces
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x (strict mode)

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (or npm)
- PostgreSQL 16+
- Firebase project with FCM enabled

### Installation

1. Clone the repository and navigate to the project:

```bash
cd push-platform
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/push_platform
API_PORT=3000
API_KEYS=your-secret-api-key
FIREBASE_PROJECT_ID=your-firebase-project-id
```

4. Run database migrations:

```bash
pnpm db:generate
pnpm migrate
```

5. Seed sample data:

```bash
pnpm --filter @push-platform/api seed-data
```

### Development

Start the API server:

```bash
pnpm dev:api
```

Start the worker:

```bash
pnpm dev:worker
```

### Docker Deployment

Build and run with Docker Compose:

```bash
docker-compose up --build
```

This will start:
- PostgreSQL database on port 5432
- API server on port 3000
- Worker process

## API Usage

### 1. Generate Onboarding Token

Generate a token for device registration:

```bash
pnpm --filter @push-platform/api generate-token -- --appSlug myapp --tenantSlug tenant1
```

### 2. Resolve Onboarding Token

```bash
curl -X POST http://localhost:3000/v1/myapp/onboard/resolve \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN_HERE"}'
```

Response:
```json
{
  "applicationId": "uuid",
  "tenantId": "uuid",
  "tenant": {
    "name": "Tenant One",
    "slug": "tenant1"
  }
}
```

### 3. Register Device

```bash
curl -X POST http://localhost:3000/v1/myapp/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "onboardingToken": "YOUR_TOKEN_HERE",
    "installId": "unique-device-id",
    "fcmToken": "fcm-token-from-firebase-sdk",
    "platform": "ios",
    "appVersion": "1.0.0",
    "osVersion": "17.0",
    "topics": ["news", "updates"]
  }'
```

Response:
```json
{
  "deviceId": "uuid",
  "success": true
}
```

### 4. Send Push Notification (Topic-based)

```bash
curl -X POST http://localhost:3000/v1/myapp/push \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "title": "Breaking News",
    "body": "This is a test notification",
    "topic": "news",
    "data": {
      "url": "https://example.com/article/123"
    }
  }'
```

Response:
```json
{
  "messageId": "uuid",
  "deliveryCount": 5,
  "status": "queued"
}
```

### 5. Send Push Notification (Device-list)

```bash
curl -X POST http://localhost:3000/v1/myapp/push \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "title": "Personal Alert",
    "body": "This message is for you",
    "deviceIds": ["device-uuid-1", "device-uuid-2"]
  }'
```

### 6. Check Push Status

```bash
curl http://localhost:3000/v1/myapp/push/{messageId} \
  -H "X-API-Key: your-secret-api-key"
```

Response:
```json
{
  "messageId": "uuid",
  "title": "Breaking News",
  "body": "This is a test notification",
  "status": "completed",
  "deliveries": {
    "queued": 0,
    "sent": 5,
    "failed": 0,
    "invalid": 0
  }
}
```

### 7. Device Heartbeat

```bash
curl -X POST http://localhost:3000/v1/myapp/devices/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"installId": "unique-device-id"}'
```

## API Documentation

Interactive API documentation is available at:

```
http://localhost:3000/documentation
```

## Worker Service

The worker service processes push notifications asynchronously using the outbox pattern:

- Polls the database every 10 seconds for queued deliveries
- Sends notifications via FCM
- Handles retries with exponential backoff (max 5 retries)
- Marks invalid tokens automatically
- Updates message status when all deliveries complete

### Error Handling

- **Invalid tokens**: Marked in database, no further attempts
- **Transient errors**: Retried with exponential backoff (2^retry_count minutes)
- **Permanent errors**: Marked as failed after max retries

## Database Schema

### Core Tables

- `applications`: Multi-app support with Firebase config
- `tenants`: Multi-tenancy within applications
- `devices`: Registered devices with install IDs
- `device_tokens`: FCM tokens linked to devices
- `onboarding_tokens`: QR-code tokens for device registration
- `push_messages`: Push notification messages
- `push_deliveries`: Outbox pattern delivery queue

## Scripts

### Database

```bash
# Generate migrations
pnpm db:generate

# Run migrations
pnpm migrate

# Open Drizzle Studio
pnpm db:studio
```

### Data Management

```bash
# Seed sample data
pnpm --filter @push-platform/api seed-data

# Generate onboarding token
pnpm --filter @push-platform/api generate-token -- --appSlug myapp --tenantSlug tenant1

# Generate token with custom expiry (48 hours)
pnpm --filter @push-platform/api generate-token -- --appSlug myapp --tenantSlug tenant1 --expiresIn 48

# Generate token with metadata
pnpm --filter @push-platform/api generate-token -- --appSlug myapp --tenantSlug tenant1 --metadata '{"topics":["vip"]}'
```

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `API_KEYS`: Comma-separated list of valid API keys

### Optional

- `API_PORT`: API server port (default: 3000)
- `API_HOST`: API server host (default: 0.0.0.0)
- `FIREBASE_PROJECT_ID`: Firebase project ID for development
- `SERVICE_ACCOUNT_JSON`: Firebase service account JSON for production
- `WORKER_POLL_INTERVAL_MS`: Worker polling interval (default: 10000)
- `WORKER_BATCH_SIZE`: Deliveries per batch (default: 100)
- `MAX_RETRY_COUNT`: Max retry attempts (default: 5)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Log level (info/debug/error)

## Development Workflow

1. Make changes to source code
2. TypeScript will compile automatically in watch mode
3. Test endpoints via curl or Postman
4. Check logs for errors
5. Run migrations if schema changes

## Production Deployment

1. Build Docker images:

```bash
docker-compose build
```

2. Set production environment variables
3. Run database migrations
4. Start services:

```bash
docker-compose up -d
```

5. Monitor logs:

```bash
docker-compose logs -f
```

## Security Considerations

- API keys should be strong and rotated regularly
- Use HTTPS in production
- Enable rate limiting (configured by default)
- Scope all queries by application and tenant
- Validate all input data
- Use prepared statements (Drizzle ORM handles this)

## Performance

- Target: 95th percentile latency < 200ms for device registration
- Target: 95th percentile latency < 100ms for push creation
- Throughput: 100,000+ messages per day
- Supports 10,000+ devices per tenant
- Horizontal scaling for API and worker

## Troubleshooting

### Database connection errors

Check `DATABASE_URL` is correct and PostgreSQL is running.

### Firebase errors

Ensure `FIREBASE_PROJECT_ID` (dev) or `SERVICE_ACCOUNT_JSON` (prod) is set correctly.

### Push notifications not sending

1. Check worker logs for errors
2. Verify FCM tokens are valid
3. Check Firebase project configuration
4. Ensure worker is running

### Invalid token errors

Devices need to re-register to get new FCM tokens.

## License

MIT
