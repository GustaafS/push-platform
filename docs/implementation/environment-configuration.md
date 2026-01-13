# Environment Configuration Guide

This guide covers configuring environment variables for Firebase in different deployment scenarios.

## Prerequisites

- Firebase project created
- Service account JSON generated (for production)
- Understanding of development vs production modes

## Configuration Modes

The Push Platform supports two Firebase configuration modes:

### Development Mode

**When to use:** Local development, testing, Firebase emulator

**Requirements:**
- `NODE_ENV=development`
- `FIREBASE_PROJECT_ID` environment variable

**Characteristics:**
- No service account credentials needed
- Firebase Admin SDK initializes with project ID only
- Suitable for local testing and emulator
- Cannot send actual push notifications to devices

### Production Mode

**When to use:** Production, staging, deployed environments

**Requirements:**
- `NODE_ENV=production` (or any value other than "development")
- Service account credentials via one of:
  - `SERVICE_ACCOUNT_JSON` (base64 encoded JSON)
  - `FIREBASE_CREDENTIALS_PATH` (file path to JSON)
  - Per-application `firebaseConfig` in database

**Characteristics:**
- Full Firebase Admin SDK functionality
- Can send push notifications to real devices
- Requires valid service account credentials

## Environment Variables Reference

### Core Firebase Variables

| Variable | Required | Mode | Description |
|----------|----------|------|-------------|
| `NODE_ENV` | Yes | All | Set to "development" or "production" |
| `FIREBASE_PROJECT_ID` | Dev: Yes, Prod: Optional | Development | Firebase project ID (e.g., "push-platform-dev-abc123") |
| `SERVICE_ACCOUNT_JSON` | Prod: Yes* | Production | Base64-encoded service account JSON |
| `FIREBASE_CREDENTIALS_PATH` | Prod: Yes* | Production | Path to firebase-credentials.json file |

*Either `SERVICE_ACCOUNT_JSON` OR `FIREBASE_CREDENTIALS_PATH` required in production (unless using per-app config in database)

### Other Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Required | PostgreSQL connection string |
| `API_PORT` | 3000 | API server port |
| `API_HOST` | 0.0.0.0 | API server host |
| `API_KEYS` | Required | Comma-separated API keys for authentication |
| `WORKER_POLL_INTERVAL_MS` | 10000 | Worker polling interval (milliseconds) |
| `WORKER_BATCH_SIZE` | 100 | Number of deliveries processed per batch |
| `MAX_RETRY_COUNT` | 5 | Maximum retry attempts for failed deliveries |

## Development Environment Setup

### Step 1: Create .env File

```bash
# Copy example environment file
cp .env.example .env
```

### Step 2: Configure Firebase for Development

Edit `.env` file:

```bash
# Environment
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/push_platform

# API Configuration
API_PORT=3000
API_HOST=0.0.0.0
API_KEYS=your-secret-api-key-here,another-key-here

# Firebase Configuration (Development)
FIREBASE_PROJECT_ID=push-platform-dev-abc123

# Worker Configuration
WORKER_POLL_INTERVAL_MS=10000
WORKER_BATCH_SIZE=100
MAX_RETRY_COUNT=5
```

### Step 3: Validate Configuration

```bash
# Validate all environment variables
pnpm --filter api run validate-env

# Validate Firebase configuration specifically
pnpm --filter api run validate-firebase
```

### Automated Setup Script

Use the development setup script:

```bash
pnpm --filter api run setup-dev-env
```

This script will:
- Prompt for Firebase Project ID
- Create or update .env file
- Validate Firebase connectivity
- Provide next steps

## Production Environment Setup

### Option 1: Base64 Encoded JSON (Recommended)

**Best for:** Docker, Kubernetes, cloud platforms

#### Step 1: Convert JSON to Base64

```bash
pnpm --filter api run json-to-base64 /path/to/firebase-credentials.json
```

#### Step 2: Set Environment Variable

The script output provides platform-specific instructions:

**Linux/Bash:**
```bash
export SERVICE_ACCOUNT_JSON="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsC..."
```

**Docker Compose:**
```yaml
services:
  api:
    environment:
      - SERVICE_ACCOUNT_JSON=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsC...
```

**Kubernetes Secret:**
```bash
kubectl create secret generic firebase-credentials \
  --from-literal=service-account-json="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsC..."
```

### Option 2: File Path

**Best for:** Traditional servers, VMs

#### Step 1: Store JSON File Securely

```bash
# Create secure directory
sudo mkdir -p /etc/push-platform/credentials
sudo chmod 700 /etc/push-platform/credentials

# Copy service account file
sudo cp firebase-credentials.json /etc/push-platform/credentials/
sudo chmod 600 /etc/push-platform/credentials/firebase-credentials.json
```

#### Step 2: Set Environment Variable

```bash
export FIREBASE_CREDENTIALS_PATH=/etc/push-platform/credentials/firebase-credentials.json
```

### Option 3: Per-Application Configuration

**Best for:** Multi-tenant deployments

Use database to store Firebase configuration per application:

```bash
# Add Firebase config to specific application
pnpm --filter api run add-app-firebase-config
```

See [Multi-App Configuration](./multi-app-configuration.md) for details.

### Automated Setup Script

Use the production setup script:

```bash
pnpm --filter api run setup-prod-env
```

This script will:
- Prompt for service account JSON file path
- Validate JSON structure
- Offer base64 encoding or file path approach
- Provide deployment-specific instructions

## Docker Deployment

### docker-compose.yml Example

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: push_platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/push_platform
      API_PORT: 3000
      API_KEYS: ${API_KEYS}
      # Option 1: Base64 encoded
      SERVICE_ACCOUNT_JSON: ${SERVICE_ACCOUNT_JSON}
      # Option 2: Volume mount (uncomment and use)
      # FIREBASE_CREDENTIALS_PATH: /app/credentials/firebase-credentials.json
    # Uncomment for file path approach
    # volumes:
    #   - ./firebase-credentials.json:/app/credentials/firebase-credentials.json:ro
    ports:
      - "3000:3000"
    depends_on:
      - postgres

  worker:
    build: .
    command: pnpm --filter @push-platform/worker start
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/push_platform
      SERVICE_ACCOUNT_JSON: ${SERVICE_ACCOUNT_JSON}
      WORKER_POLL_INTERVAL_MS: 10000
      WORKER_BATCH_SIZE: 100
      MAX_RETRY_COUNT: 5
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### .env file for Docker Compose

```bash
# DO NOT COMMIT THIS FILE
API_KEYS=your-production-api-key-here
SERVICE_ACCOUNT_JSON=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsC...
```

## Kubernetes Deployment

### Step 1: Create Secret

```bash
# Create secret from base64-encoded JSON
kubectl create secret generic firebase-credentials \
  --from-literal=service-account-json="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsC..."

# Or from file
kubectl create secret generic firebase-credentials \
  --from-file=service-account.json=firebase-credentials.json
```

### Step 2: Reference in Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: push-platform-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: push-platform-api
  template:
    metadata:
      labels:
        app: push-platform-api
    spec:
      containers:
      - name: api
        image: push-platform-api:latest
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: API_KEYS
          valueFrom:
            secretKeyRef:
              name: api-credentials
              key: keys
        # Option 1: From secret (base64)
        - name: SERVICE_ACCOUNT_JSON
          valueFrom:
            secretKeyRef:
              name: firebase-credentials
              key: service-account-json
        # Option 2: Mount as file
        # - name: FIREBASE_CREDENTIALS_PATH
        #   value: /etc/firebase/credentials.json
        # volumeMounts:
        # - name: firebase-credentials
        #   mountPath: /etc/firebase
        #   readOnly: true
        ports:
        - containerPort: 3000
      # Uncomment for file mount approach
      # volumes:
      # - name: firebase-credentials
      #   secret:
      #     secretName: firebase-credentials
      #     items:
      #     - key: service-account.json
      #       path: credentials.json
```

## Cloud Platform Examples

### AWS Elastic Beanstalk

Set environment variables in Elastic Beanstalk console:

1. Navigate to Environment > Configuration > Software
2. Add environment properties:
   - `NODE_ENV`: `production`
   - `SERVICE_ACCOUNT_JSON`: `<base64-encoded-json>`
   - `DATABASE_URL`: `<rds-connection-string>`
   - `API_KEYS`: `<your-api-keys>`

### AWS ECS

Use task definition:

```json
{
  "containerDefinitions": [
    {
      "name": "push-platform-api",
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "SERVICE_ACCOUNT_JSON",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:firebase-creds"
        },
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:database-url"
        }
      ]
    }
  ]
}
```

### Google Cloud Run

```bash
# Deploy with environment variable
gcloud run deploy push-platform-api \
  --image gcr.io/project/push-platform-api \
  --set-env-vars NODE_ENV=production \
  --set-env-vars SERVICE_ACCOUNT_JSON="$(cat firebase-credentials.json | base64)" \
  --set-env-vars DATABASE_URL="postgres://..."
```

### Heroku

```bash
# Set config vars
heroku config:set NODE_ENV=production
heroku config:set SERVICE_ACCOUNT_JSON="$(cat firebase-credentials.json | base64)"
heroku config:set DATABASE_URL="postgres://..."
heroku config:set API_KEYS="key1,key2"
```

## Environment Variable Precedence

The Push Platform checks for Firebase configuration in this order:

1. **Per-application database config** (`applications.firebaseConfig` JSONB column)
2. **SERVICE_ACCOUNT_JSON** environment variable (base64 encoded)
3. **FIREBASE_CREDENTIALS_PATH** environment variable (file path)
4. **FIREBASE_PROJECT_ID** (development mode only)

If none are found, initialization will fail with a clear error message.

## Validation

### Validate All Environment Variables

```bash
pnpm --filter api run validate-env
```

Checks:
- NODE_ENV is set correctly
- Required variables for current mode are present
- Firebase configuration is valid
- Database connection works
- API keys are configured

### Validate Firebase Only

```bash
pnpm --filter api run validate-firebase
```

Focused Firebase checks:
- Configuration variables are set
- Service account JSON is valid (if production)
- Firebase connection works
- Messaging API is accessible

## Troubleshooting

### Issue: "Firebase configuration not found"

**Development Mode:**
- Check `NODE_ENV=development` is set
- Ensure `FIREBASE_PROJECT_ID` is set
- Run: `pnpm --filter api run validate-env`

**Production Mode:**
- Check `NODE_ENV` is NOT "development"
- Ensure `SERVICE_ACCOUNT_JSON` OR `FIREBASE_CREDENTIALS_PATH` is set
- Verify service account JSON is valid
- Run: `pnpm --filter api run validate-service-account`

### Issue: "Invalid service account JSON"

**Cause:** Malformed JSON or encoding issues

**Solution:**
- Re-encode using: `pnpm --filter api run json-to-base64`
- Verify no newlines or special characters in environment variable
- Check JSON file is not corrupted
- Try file path approach instead

### Issue: "Environment variable not set in Docker"

**Cause:** Variable not passed to container

**Solution:**
- Check docker-compose.yml has environment section
- Ensure .env file exists and is in same directory
- Use `docker-compose config` to verify variable substitution
- Check container env with: `docker exec <container> env`

### Issue: "Kubernetes pod can't find secret"

**Cause:** Secret not created or named incorrectly

**Solution:**
- Verify secret exists: `kubectl get secrets`
- Check secret name matches deployment YAML
- Verify secret has correct key name
- Describe secret: `kubectl describe secret firebase-credentials`

## Security Best Practices

### 1. Never Commit Credentials

```gitignore
# Already in .gitignore
.env
.env.local
firebase-credentials.json
```

### 2. Use Secret Management

- **AWS**: Secrets Manager or Parameter Store
- **Google Cloud**: Secret Manager
- **Azure**: Key Vault
- **HashiCorp**: Vault

### 3. Rotate Credentials Regularly

- Production: Every 90 days
- Staging: Every 180 days
- Development: Yearly or as needed

### 4. Limit Environment Access

- Use role-based access control (RBAC)
- Audit who can view environment variables
- Separate dev/staging/prod credentials

### 5. Monitor Usage

- Enable Cloud Audit Logs
- Alert on configuration changes
- Track who accesses secrets

## Next Steps

After configuring environment variables:

1. [Set up multi-application Firebase support](./multi-app-configuration.md)
2. [Test push notifications](./testing-guide.md)
3. [Review troubleshooting guide](./troubleshooting.md)

## Additional Resources

- [Docker Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)
