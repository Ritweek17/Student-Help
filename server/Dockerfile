# Multi-stage production Dockerfile for CareerOS Backend API & Workers
# ------------------------------------------------------------------------------
# Stage 1: Dependency Installation
# ------------------------------------------------------------------------------
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install only production dependencies deterministically
RUN npm ci --omit=dev

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Production environment defaults
ENV NODE_ENV=production \
    PORT=5000

# Copy installed production node_modules from builder
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules

# Copy package manifest and application source
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Run as non-privileged node user for security
USER node

# Expose API listener port
EXPOSE 5000

# Default entrypoint starts the HTTP API server.
# Overridden via command for reminder and ingestion background workers:
# - Reminder worker:  node src/workers/reminder.worker.js
# - Ingestion worker: node src/workers/ingestion.worker.js
CMD ["node", "src/server.js"]
