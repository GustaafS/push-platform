# Deployment Documentation

This document provides comprehensive instructions for configuring GitHub secrets, setting up environments, and deploying the Push Platform to staging and production environments.

## Table of Contents

1. [GitHub Environments Setup](#github-environments-setup)
2. [Required Secrets](#required-secrets)
3. [Deployment Workflows](#deployment-workflows)
4. [Platform-Specific Deployment](#platform-specific-deployment)
5. [Health Checks and Monitoring](#health-checks-and-monitoring)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## GitHub Environments Setup

### 1. Create Environments

Navigate to your GitHub repository:
1. Go to **Settings** → **Environments**
2. Create two environments:
   - **staging** (no protection rules)
   - **production** (with protection rules)

### 2. Configure Production Protection Rules

For the production environment:
1. Enable **Required reviewers**
2. Add team members who must approve production deployments
3. Optionally set a **Wait timer** (e.g., 5 minutes) before deployment
4. Enable **Deployment branches** and restrict to tags matching `v*.*.*`

---

## Required Secrets

### GitHub Container Registry Permissions

The `GITHUB_TOKEN` is automatically provided and has the necessary permissions to:
- Read from GitHub Container Registry
- Write/push Docker images to GitHub Container Registry
- Create deployment statuses

**No additional configuration needed for container registry access.**

### Staging Environment Secrets

Navigate to **Settings** → **Environments** → **staging** → **Environment secrets**:

| Secret Name | Description | Example Value | Required |
|------------|-------------|---------------|----------|
| `DATABASE_URL` | PostgreSQL connection string for staging database | `postgresql://user:pass@staging-db.example.com:5432/push_platform` | Yes |
| `FIREBASE_PROJECT_ID` | Firebase project ID for staging (development mode) | `my-project-staging` | Yes |
| `API_KEYS` | Comma-separated list of valid API keys for staging | `staging-key-1,staging-key-2` | Yes |
| `API_URL` | Staging API URL for health checks | `https://api-staging.example.com` | Optional |
| `WORKER_URL` | Staging Worker URL for deployment tracking | `https://worker-staging.example.com` | Optional |

### Production Environment Secrets

Navigate to **Settings** → **Environments** → **production** → **Environment secrets**:

| Secret Name | Description | Example Value | Required |
|------------|-------------|---------------|----------|
| `DATABASE_URL` | PostgreSQL connection string for production database | `postgresql://user:pass@prod-db.example.com:5432/push_platform` | Yes |
| `SERVICE_ACCOUNT_JSON` | Firebase service account JSON (escaped) | `{"type":"service_account","project_id":"..."}` | Yes |
| `API_KEYS` | Comma-separated list of valid API keys for production | `prod-key-1,prod-key-2,prod-key-3` | Yes |
| `API_URL` | Production API URL for health checks | `https://api.example.com` | Optional |
| `WORKER_URL` | Production Worker URL for deployment tracking | `https://worker.example.com` | Optional |

### Adding Secrets to GitHub

1. Navigate to repository **Settings** → **Environments** → Select environment
2. Click **Add secret**
3. Enter the secret name (exactly as shown in tables above)
4. Paste the secret value
5. Click **Add secret**

**Important Security Notes:**
- Never commit secrets to the repository
- Use strong, unique API keys for each environment
- Rotate secrets regularly (recommended: every 90 days)
- Store SERVICE_ACCOUNT_JSON as a single-line escaped JSON string
- Limit DATABASE_URL access to specific IP ranges when possible

---

## Deployment Workflows

### CI Workflow (Continuous Integration)

**Triggers:**
- Push to any branch
- Pull request to any branch
- Manual workflow dispatch

**Steps:**
1. Install dependencies with pnpm
2. Run TypeScript type checking
3. Run ESLint (if configured)
4. Run tests with vitest
5. Build all packages and applications

**Skip CI:**
Include `[skip ci]` in your commit message to skip the CI workflow.

### Docker Build Workflow

**Triggers:**
- Push to `main` branch
- Tag creation matching `v*.*.*`
- Manual workflow dispatch

**Steps:**
1. Build API Docker image
2. Build Worker Docker image
3. Tag images with:
   - Git SHA (`sha-abc123`)
   - Branch name (`main`)
   - Semantic version (on tags: `v1.0.0`, `1.0`, `latest`)
4. Push images to GitHub Container Registry (`ghcr.io`)

**Image URLs:**
- API: `ghcr.io/<owner>/push-platform-api:<tag>`
- Worker: `ghcr.io/<owner>/push-platform-worker:<tag>`

### Staging Deployment Workflow

**Triggers:**
- Automatic: Push to `main` branch
- Manual: workflow_dispatch

**Steps:**
1. Run database migrations
2. Deploy API container
3. Deploy Worker container (parallel with API)
4. Run health check on API

**Environment:** staging

**Auto-deploy:** Yes (no approval required)

### Production Deployment Workflow

**Triggers:**
- Automatic: Tag creation matching `v*.*.*`
- Manual: workflow_dispatch with version input

**Steps:**
1. Run database migrations
2. Deploy API container
3. Deploy Worker container (parallel with API)
4. Run health check on API

**Environment:** production

**Auto-deploy:** No (requires approval from designated reviewers)

### Workflow Dependencies

```
Push to main:
  CI → Docker Build → Deploy Staging

Tag v*.*.*:
  CI → Docker Build → Deploy Production (with approval)
```

---

## Platform-Specific Deployment

The workflows provide deployment instructions but require platform-specific CLI integration. Choose your platform below:

### Option 1: Railway

**Prerequisites:**
- Install Railway CLI: `npm i -g @railway/cli`
- Login: `railway login`
- Link project: `railway link`

**Add to deployment steps in workflow:**

```yaml
- name: Deploy API to Railway
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
  run: |
    railway up --service api --environment staging
    railway variables set \
      DATABASE_URL="${{ secrets.DATABASE_URL }}" \
      FIREBASE_PROJECT_ID="${{ secrets.FIREBASE_PROJECT_ID }}" \
      API_KEYS="${{ secrets.API_KEYS }}" \
      NODE_ENV=production \
      API_PORT=3000 \
      API_HOST=0.0.0.0
```

**Required Secret:** `RAILWAY_TOKEN` (get from Railway dashboard)

### Option 2: Google Cloud Run

**Prerequisites:**
- Install gcloud CLI
- Create service account with Cloud Run Admin role
- Download service account JSON key

**Add to deployment steps in workflow:**

```yaml
- name: Setup Google Cloud
  uses: google-github-actions/setup-gcloud@v1
  with:
    service_account_key: ${{ secrets.GCP_SA_KEY }}
    project_id: ${{ secrets.GCP_PROJECT_ID }}

- name: Deploy API to Cloud Run
  run: |
    gcloud run deploy push-platform-api \
      --image ghcr.io/${{ github.repository_owner }}/push-platform-api:sha-${{ github.sha }} \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars DATABASE_URL="${{ secrets.DATABASE_URL }}",FIREBASE_PROJECT_ID="${{ secrets.FIREBASE_PROJECT_ID }}",API_KEYS="${{ secrets.API_KEYS }}",NODE_ENV=production,API_PORT=3000,API_HOST=0.0.0.0
```

**Required Secrets:**
- `GCP_SA_KEY` (service account JSON key)
- `GCP_PROJECT_ID` (Google Cloud project ID)

### Option 3: AWS ECS/Fargate

**Prerequisites:**
- Configure AWS credentials
- Create ECS cluster and task definitions

**Add to deployment steps in workflow:**

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v2
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1

- name: Deploy to ECS
  run: |
    aws ecs update-service \
      --cluster push-platform-staging \
      --service api \
      --force-new-deployment \
      --task-definition api:latest
```

**Required Secrets:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Option 4: Generic Docker Host

**Prerequisites:**
- SSH access to server
- Docker installed on server

**Add to deployment steps in workflow:**

```yaml
- name: Deploy via SSH
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.SERVER_HOST }}
    username: ${{ secrets.SERVER_USER }}
    key: ${{ secrets.SSH_PRIVATE_KEY }}
    script: |
      docker pull ghcr.io/${{ github.repository_owner }}/push-platform-api:sha-${{ github.sha }}
      docker stop api || true
      docker rm api || true
      docker run -d --name api \
        -e DATABASE_URL="${{ secrets.DATABASE_URL }}" \
        -e FIREBASE_PROJECT_ID="${{ secrets.FIREBASE_PROJECT_ID }}" \
        -e API_KEYS="${{ secrets.API_KEYS }}" \
        -e NODE_ENV=production \
        -e API_PORT=3000 \
        -e API_HOST=0.0.0.0 \
        -p 3000:3000 \
        --restart unless-stopped \
        ghcr.io/${{ github.repository_owner }}/push-platform-api:sha-${{ github.sha }}
```

**Required Secrets:**
- `SERVER_HOST` (IP or hostname)
- `SERVER_USER` (SSH username)
- `SSH_PRIVATE_KEY` (SSH private key)

---

## Health Checks and Monitoring

### API Health Endpoint

The API includes a health check endpoint at `/health`:

**Response (Success - 200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-12T10:30:00.000Z",
  "version": "1.0.0",
  "database": "connected"
}
```

**Response (Failure - 503):**
```json
{
  "status": "error",
  "timestamp": "2024-01-12T10:30:00.000Z",
  "version": "1.0.0",
  "database": "disconnected",
  "error": "Database connection failed"
}
```

### Automated Health Check

To enable automated health checks in the deployment workflow:

1. Add `API_URL` secret to your environment (e.g., `https://api-staging.example.com`)
2. Update the health check step in the deployment workflow:

```yaml
- name: Check API health endpoint
  env:
    API_URL: ${{ secrets.API_URL }}
  run: |
    echo "Running health check on $API_URL/health"
    for i in {1..5}; do
      response=$(curl -s -w "\n%{http_code}" $API_URL/health)
      status_code=$(echo "$response" | tail -n1)
      body=$(echo "$response" | head -n-1)

      if [ $status_code -eq 200 ]; then
        if echo "$body" | grep -q '"status":"ok"' && echo "$body" | grep -q '"database":"connected"'; then
          echo "Health check passed!"
          echo "Response: $body"
          exit 0
        fi
      fi

      echo "Attempt $i failed (status: $status_code), retrying in 10 seconds..."
      sleep 10
    done

    echo "Health check failed after 5 attempts"
    exit 1
```

### Deployment Status

Deployment status is automatically tracked in GitHub:
- View in **Actions** tab
- View in **Deployments** section (repository sidebar)
- Receive notifications if configured

---

## Rollback Procedures

### Automatic Rollback

Currently, the workflow marks deployments as failed if health checks fail, but automatic rollback is not implemented. Manual rollback is required.

### Manual Rollback (Production)

If a production deployment fails or introduces issues:

1. **Find the previous successful version:**
   - Go to **Releases** in GitHub
   - Identify the last known good version (e.g., `v1.0.0`)

2. **Trigger rollback deployment:**
   - Go to **Actions** tab
   - Select **Deploy to Production** workflow
   - Click **Run workflow**
   - Select branch: `main`
   - Enter version: `v1.0.0` (previous version)
   - Click **Run workflow**
   - Approve the deployment when prompted

3. **Direct Docker rollback (emergency):**
   ```bash
   # Pull previous version
   docker pull ghcr.io/<owner>/push-platform-api:v1.0.0

   # Deploy previous version using your platform
   # Railway:
   railway up --service api --environment production

   # Cloud Run:
   gcloud run deploy push-platform-api \
     --image ghcr.io/<owner>/push-platform-api:v1.0.0 \
     --platform managed \
     --region us-central1
   ```

### Manual Rollback (Staging)

1. **Find the git SHA of the previous successful deployment:**
   - Go to **Actions** tab → **Deploy to Staging**
   - Find the last successful run
   - Note the commit SHA

2. **Deploy specific SHA:**
   - Push or re-run the workflow with that commit
   - Or deploy the Docker image directly:
   ```bash
   docker pull ghcr.io/<owner>/push-platform-api:sha-abc123
   # Deploy using your platform
   ```

### Database Migration Rollback

Database migrations are **not automatically rolled back**. If a migration causes issues:

1. **Create a rollback migration:**
   ```bash
   # Create a new migration that reverses the changes
   pnpm db:generate
   # Edit the migration file to reverse changes
   pnpm migrate
   ```

2. **Restore from backup:**
   - If migration is destructive, restore database from backup
   - Ensure backups are taken before each production deployment

---

## Troubleshooting

### Build Failures

**Issue:** CI workflow fails during build

**Solutions:**
- Check TypeScript errors: `pnpm exec tsc --noEmit`
- Run tests locally: `pnpm test`
- Clear cache and reinstall: `rm -rf node_modules && pnpm install`

### Docker Build Failures

**Issue:** Docker build fails to push images

**Solutions:**
- Verify GITHUB_TOKEN has `packages:write` permission (automatic in workflows)
- Check Dockerfile syntax
- Ensure all dependencies are in pnpm-lock.yaml
- Check Docker build logs in Actions tab

### Migration Failures

**Issue:** Database migration fails during deployment

**Solutions:**
- Verify DATABASE_URL secret is correct
- Check database connectivity
- Review migration logs in workflow output
- Run migrations locally to test: `DATABASE_URL=<url> pnpm migrate`
- Ensure database user has migration permissions

### Deployment Failures

**Issue:** Deployment workflow fails

**Solutions:**
- Verify all required secrets are set for the environment
- Check platform-specific CLI is installed and configured
- Review deployment logs
- Ensure Docker images were built successfully
- Verify network connectivity to deployment platform

### Health Check Failures

**Issue:** Health check fails after deployment

**Solutions:**
- Verify API_URL secret is correct
- Check API logs for errors
- Verify database connection from API
- Ensure all environment variables are set correctly
- Check firewall/security group rules
- Increase health check timeout if needed

### Secret Management Issues

**Issue:** Secrets not accessible in workflow

**Solutions:**
- Verify secrets are added to correct environment (staging vs production)
- Check secret names match exactly (case-sensitive)
- Ensure workflow is using correct environment
- Re-add secret if recently updated

### Container Registry Issues

**Issue:** Cannot pull Docker images

**Solutions:**
- Verify you're logged in: `docker login ghcr.io`
- Check package visibility (should be private)
- Ensure GITHUB_TOKEN has read permissions
- Verify image tag exists

---

## Best Practices

### 1. Versioning

- Use semantic versioning for releases: `v1.0.0`, `v1.1.0`, `v2.0.0`
- Tag releases in GitHub
- Update version in package.json before tagging

### 2. Environment Parity

- Keep staging and production environments as similar as possible
- Use same environment variables (different values)
- Test migrations on staging before production

### 3. Security

- Rotate secrets every 90 days
- Use strong, unique API keys
- Limit database user permissions
- Enable environment protection rules for production
- Review deployment approvals carefully

### 4. Monitoring

- Set up application monitoring (e.g., Sentry, DataDog)
- Configure log aggregation
- Set up alerts for deployment failures
- Monitor database performance

### 5. Documentation

- Document all manual deployment steps
- Keep this file updated with changes
- Document rollback procedures
- Maintain changelog for releases

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry Guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)

---

## Support

For issues or questions:
1. Check this documentation
2. Review workflow logs in Actions tab
3. Check existing GitHub Issues
4. Create a new issue with detailed information
