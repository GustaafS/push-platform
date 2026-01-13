# CI/CD Pipeline Quick Reference Guide

This guide provides a quick overview of the CI/CD pipeline for the Push Platform.

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Developer Workflow                       │
└─────────────────────────────────────────────────────────────────┘

Feature Branch                Main Branch                Release Tag
     │                            │                            │
     ├─> Push                     ├─> Push                     ├─> Tag v1.0.0
     │                            │                            │
     v                            v                            v
  ┌──────┐                    ┌──────┐                    ┌──────┐
  │  CI  │                    │  CI  │                    │  CI  │
  └──┬───┘                    └──┬───┘                    └──┬───┘
     │                            │                            │
     v                            v                            v
  Pass/Fail                   ┌─────────┐                ┌─────────┐
                              │ Docker  │                │ Docker  │
                              │ Build   │                │ Build   │
                              └────┬────┘                └────┬────┘
                                   │                          │
                                   v                          v
                              ┌─────────┐            ┌──────────────┐
                              │ Deploy  │            │   Deploy     │
                              │ Staging │            │ Production   │
                              └─────────┘            │ (w/ Approval)│
                                                     └──────────────┘
```

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Purpose:** Validate code quality on every push and pull request

**Triggers:**
- Push to any branch
- Pull request to any branch
- Manual dispatch

**Jobs:**
1. Install dependencies (with caching)
2. Type check (TypeScript)
3. Lint (ESLint, if configured)
4. Test (vitest)
5. Build (all packages)

**Duration:** ~3-5 minutes

**Skip:** Add `[skip ci]` to commit message

---

### 2. Docker Build Workflow (`.github/workflows/docker-build.yml`)

**Purpose:** Build and push Docker images to GitHub Container Registry

**Triggers:**
- Push to `main` branch
- Tag creation (v*.*.*)
- Manual dispatch

**Jobs:**
1. Build API image
2. Build Worker image

**Image Tags:**
- `latest` (on main branch)
- `sha-{git-sha}` (all builds)
- `v1.0.0`, `1.0` (on release tags)

**Duration:** ~5-10 minutes

**Images:**
- `ghcr.io/<owner>/push-platform-api:<tag>`
- `ghcr.io/<owner>/push-platform-worker:<tag>`

---

### 3. Deploy Staging Workflow (`.github/workflows/deploy-staging.yml`)

**Purpose:** Deploy to staging environment automatically

**Triggers:**
- Push to `main` branch (automatic)
- Manual dispatch

**Jobs:**
1. Run database migrations
2. Deploy API
3. Deploy Worker (parallel with API)
4. Health check API

**Duration:** ~5-8 minutes

**Environment:** staging

**Approval:** Not required

---

### 4. Deploy Production Workflow (`.github/workflows/deploy-production.yml`)

**Purpose:** Deploy to production environment with approval

**Triggers:**
- Tag creation (v*.*.*)
- Manual dispatch (with version input)

**Jobs:**
1. Run database migrations
2. Deploy API
3. Deploy Worker (parallel with API)
4. Health check API

**Duration:** ~5-10 minutes (+ approval time)

**Environment:** production

**Approval:** Required (designated reviewers)

---

## Common Tasks

### Deploy to Staging

```bash
# Merge your PR to main
git checkout main
git pull origin main

# Staging deployment happens automatically
# Check Actions tab for progress
```

### Deploy to Production

```bash
# Create and push a release tag
git checkout main
git pull origin main
git tag v1.0.0
git push origin v1.0.0

# Go to GitHub Actions tab
# Approve the production deployment when prompted
```

### Manual Deployment

```bash
# Go to GitHub repository
# Click Actions tab
# Select workflow (Deploy to Staging or Deploy to Production)
# Click "Run workflow"
# Select branch/tag and click "Run workflow"
```

### Rollback Production

```bash
# Option 1: Via GitHub UI
# Go to Actions → Deploy to Production → Run workflow
# Enter previous version (e.g., v1.0.0)

# Option 2: Via git tag
git tag -d v1.1.0  # Delete bad tag locally
git push origin :refs/tags/v1.1.0  # Delete from remote
git tag v1.1.0 <previous-good-commit>  # Re-tag
git push origin v1.1.0  # Push corrected tag
```

---

## Environment Variables

### Staging

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `FIREBASE_PROJECT_ID` | Firebase project | `my-project-staging` |
| `API_KEYS` | Valid API keys | `key1,key2` |
| `API_URL` | API endpoint (optional) | `https://api-staging.example.com` |

### Production

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `SERVICE_ACCOUNT_JSON` | Firebase credentials | `{"type":"service_account",...}` |
| `API_KEYS` | Valid API keys | `key1,key2,key3` |
| `API_URL` | API endpoint (optional) | `https://api.example.com` |

---

## Troubleshooting

### CI Fails

**Check:**
1. TypeScript errors: `pnpm exec tsc --noEmit`
2. Test failures: `pnpm test`
3. Build errors: `pnpm build`

**Fix:**
1. Fix errors locally
2. Commit and push
3. CI will re-run automatically

### Docker Build Fails

**Check:**
1. Dockerfile syntax
2. Dependencies in pnpm-lock.yaml
3. Build logs in Actions tab

**Fix:**
1. Test Docker build locally: `docker build -f apps/api/Dockerfile .`
2. Fix issues and push

### Migration Fails

**Check:**
1. DATABASE_URL secret is set correctly
2. Database is accessible
3. Migration logs in Actions tab

**Fix:**
1. Test locally: `DATABASE_URL=<url> pnpm migrate`
2. Fix migration issues
3. Push fix and re-run deployment

### Deployment Fails

**Check:**
1. All required secrets are set
2. Docker images built successfully
3. Platform-specific CLI configured

**Fix:**
1. Verify secrets in GitHub Settings → Environments
2. Check deployment logs
3. Re-run deployment workflow

---

## Monitoring

### Check Deployment Status

1. Go to repository on GitHub
2. Click **Actions** tab
3. View workflow runs
4. Click on a run to see detailed logs

### Check API Health

```bash
# Staging
curl https://api-staging.example.com/health

# Production
curl https://api.example.com/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-12T10:30:00.000Z",
  "version": "1.0.0",
  "database": "connected"
}
```

---

## Best Practices

### 1. Development Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add my feature"

# Push and create PR
git push origin feature/my-feature
# Create PR on GitHub

# CI runs automatically on PR
# Fix any issues
# Get approval and merge

# Staging deployment happens automatically on merge
```

### 2. Release Workflow

```bash
# Update version in package.json
npm version patch  # or minor, major

# Create release tag
git tag v1.0.1
git push origin v1.0.1

# Production deployment workflow triggers
# Review and approve deployment
```

### 3. Hotfix Workflow

```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-fix

# Fix issue and commit
git add .
git commit -m "Fix critical bug"

# Create PR and merge quickly
git push origin hotfix/critical-fix

# Create hotfix release tag
git tag v1.0.2
git push origin v1.0.2

# Approve production deployment
```

---

## Security Checklist

- [ ] Secrets configured for staging environment
- [ ] Secrets configured for production environment
- [ ] Production environment has required reviewers
- [ ] API keys are strong and unique
- [ ] DATABASE_URL uses secure credentials
- [ ] SERVICE_ACCOUNT_JSON is valid and secured
- [ ] Container images set to private visibility
- [ ] Secret rotation schedule established (90 days)

---

## Additional Resources

- [Full Deployment Documentation](.github/DEPLOYMENT.md)
- [Staging Environment Template](.github/environments/staging.env.template)
- [Production Environment Template](.github/environments/production.env.template)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)

---

## Quick Commands

```bash
# Local development
pnpm install          # Install dependencies
pnpm dev:api          # Run API locally
pnpm dev:worker       # Run Worker locally
pnpm test             # Run tests
pnpm build            # Build all packages
pnpm migrate          # Run migrations

# Docker
docker build -f apps/api/Dockerfile -t api .
docker build -f apps/worker/Dockerfile -t worker .
docker run -p 3000:3000 api

# Git
git tag v1.0.0                    # Create release tag
git push origin v1.0.0            # Push tag (triggers production deploy)
git tag -d v1.0.0                 # Delete local tag
git push origin :refs/tags/v1.0.0 # Delete remote tag
```
