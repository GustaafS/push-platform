# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/worker ./apps/worker

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages
RUN pnpm --filter @push-platform/db build
RUN pnpm --filter @push-platform/shared build
RUN pnpm --filter @push-platform/worker build

# Runtime stage
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker ./apps/worker

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

CMD ["node", "apps/worker/dist/index.js"]
