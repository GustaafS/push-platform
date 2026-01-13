# GitHub Actions CI/CD Pipeline

This directory contains the complete CI/CD pipeline configuration for the Push Platform.

## Overview

The Push Platform uses GitHub Actions to automate testing, building Docker images, and deploying to staging and production environments.

## Workflows

### 1. CI Workflow (`workflows/ci.yml`)
Validates code quality on every push and pull request.

- **Triggers:** Push to any branch, pull requests, manual dispatch
- **Jobs:** Install → Parallel (Typecheck, Lint, Test) → Build
- **Duration:** ~3-5 minutes

### 2. Docker Build (`workflows/docker-build.yml`)
Builds and pushes Docker images to GitHub Container Registry.

- **Triggers:** Push to main, release tags (v*.*.*), manual dispatch
- **Jobs:** Build API image, Build Worker image (parallel)
- **Duration:** ~5-10 minutes
- **Output:** Images at `ghcr.io/<owner>/push-platform-{api|worker}:<tag>`

### 3. Deploy Staging (`workflows/deploy-staging.yml`)
Automatically deploys to staging environment.

- **Triggers:** Push to main (after Docker build), manual dispatch
- **Jobs:** Migrate → Parallel (Deploy API, Deploy Worker) → Health Check
- **Duration:** ~5-8 minutes
- **Approval:** Not required

### 4. Deploy Production (`workflows/deploy-production.yml`)
Deploys to production with approval gate.

- **Triggers:** Release tags (v*.*.*), manual dispatch with version
- **Jobs:** Migrate → Parallel (Deploy API, Deploy Worker) → Health Check
- **Duration:** ~5-10 minutes + approval time
- **Approval:** Required from designated reviewers

## Quick Start

### For Developers

1. **Development workflow:**
   ```bash
   # Create feature branch
   git checkout -b feature/my-feature

   # Make changes and push
   git push origin feature/my-feature

   # Create PR - CI runs automatically
   # Merge PR - deploys to staging automatically
   ```

2. **Skip CI (when needed):**
   ```bash
   git commit -m "docs: update README [skip ci]"
   ```

### For DevOps

1. **Setup GitHub Environments:**
   - Go to Settings → Environments
   - Create "staging" (no protection)
   - Create "production" (with required reviewers)

2. **Configure Secrets:**
   - See `environments/staging.env.template`
   - See `environments/production.env.template`
   - Add secrets to each environment

3. **Production Release:**
   ```bash
   # Create and push release tag
   git tag v1.0.0
   git push origin v1.0.0

   # Approve deployment in GitHub Actions
   ```

## Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
  - GitHub environment setup
  - Secrets configuration
  - Platform-specific deployment instructions
  - Health checks and monitoring
  - Rollback procedures
  - Troubleshooting

- **[CICD_GUIDE.md](CICD_GUIDE.md)** - Quick reference guide
  - Pipeline overview
  - Workflow details
  - Common tasks
  - Best practices

- **[environments/staging.env.template](environments/staging.env.template)** - Staging secrets template

- **[environments/production.env.template](environments/production.env.template)** - Production secrets template

## Architecture

```
Developer Push
     ↓
┌────────────────┐
│   CI Workflow  │  (All branches)
│  - Typecheck   │
│  - Lint        │
│  - Test        │
│  - Build       │
└────────┬───────┘
         ↓
┌────────────────┐
│ Docker Build   │  (main branch, tags)
│  - Build API   │
│  - Build Worker│
└────────┬───────┘
         ↓
    ┌────┴────┐
    ↓         ↓
┌─────────┐ ┌──────────────┐
│ Staging │ │ Production   │
│ (Auto)  │ │ (w/Approval) │
└─────────┘ └──────────────┘
```

## Deployment Flow

1. **Code Quality (CI)**
   - Install dependencies (with caching)
   - Run type checking, linting, tests
   - Build all packages

2. **Container Images (Docker)**
   - Build API and Worker images
   - Tag with SHA, branch, version
   - Push to GitHub Container Registry

3. **Database Migrations**
   - Run before deployment
   - Use environment-specific DATABASE_URL
   - Timeout: 5 minutes

4. **Application Deployment**
   - Deploy API and Worker containers
   - Set environment variables
   - Timeout: 10 minutes

5. **Health Verification**
   - Check /health endpoint
   - Verify database connectivity
   - Fail deployment if unhealthy

## Environment Variables

### Staging Environment

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `FIREBASE_PROJECT_ID` | Firebase project for FCM |
| `API_KEYS` | Comma-separated API keys |
| `API_URL` | API endpoint (optional) |
| `WORKER_URL` | Worker endpoint (optional) |

### Production Environment

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SERVICE_ACCOUNT_JSON` | Firebase service account JSON |
| `API_KEYS` | Comma-separated API keys |
| `API_URL` | API endpoint (optional) |
| `WORKER_URL` | Worker endpoint (optional) |

## Container Images

Built images are pushed to GitHub Container Registry:

- **API:** `ghcr.io/<owner>/push-platform-api`
- **Worker:** `ghcr.io/<owner>/push-platform-worker`

**Tags:**
- `latest` - Latest build from main branch
- `sha-<git-sha>` - Specific commit (all builds)
- `v1.0.0`, `1.0` - Semantic version (release tags)

## Security

- Secrets stored as GitHub environment secrets
- Container images set to private visibility
- Production requires approval from reviewers
- GITHUB_TOKEN permissions scoped per workflow
- Regular secret rotation recommended (90 days)

## Platform Support

Workflows provide deployment instructions for:
- Railway
- Google Cloud Run
- AWS ECS/Fargate
- Generic Docker hosts

To enable automatic deployment, configure platform-specific CLI in workflow files.

## Monitoring

- View workflow runs in GitHub Actions tab
- Check deployment status in Deployments section
- Health check endpoint: `<api-url>/health`

## Troubleshooting

Common issues and solutions:

1. **CI Fails:** Check typecheck, lint, and test locally
2. **Docker Build Fails:** Test Docker build locally
3. **Migration Fails:** Verify DATABASE_URL and test locally
4. **Deployment Fails:** Check secrets and platform configuration
5. **Health Check Fails:** Verify API_URL and check API logs

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting.

## Contributing

When making changes to workflows:

1. Test locally when possible
2. Document changes in this README
3. Update DEPLOYMENT.md if secrets/config changes
4. Test in staging before production

## Support

For questions or issues:
- Review [DEPLOYMENT.md](DEPLOYMENT.md)
- Review [CICD_GUIDE.md](CICD_GUIDE.md)
- Check workflow logs in Actions tab
- Create GitHub issue with details

---

Last Updated: 2026-01-12
