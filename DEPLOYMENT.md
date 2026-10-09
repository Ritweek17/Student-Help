# CareerOS Deployment & Operations Guide

This guide details the operational architecture, container configuration, local execution, and production deployment procedures for the **CareerOS** platform.

---

## 1. Prerequisites

Before running or deploying CareerOS, ensure the host environment meets the following baseline requirements:

| Component | Required Version / Specification | Notes |
|:---|:---|:---|
| **Node.js** | `>= 20.19.0 LTS` (Node 20 or 22 recommended) | Required for local development and build tooling. |
| **npm** | `>= 10.0.0` | Package manager for dependency lockfile management. |
| **Docker Engine** | `>= 24.0.0` | Container runtime engine. |
| **Docker Compose** | `>= 2.20.0` (Compose v2) | Multi-container orchestration (`docker compose`). |
| **MongoDB** | `>= 7.0` (Replica Set enabled) | Replica Set (`rs0`) required for multi-document Mongoose transactions. |

> [!IMPORTANT]
> **MongoDB Replica Set Requirement:** CareerOS utilizes Mongoose multi-document transactions in core workflows (e.g., student profile updates, application tracking, refresh token rotation). The target MongoDB cluster **must** run as a replica set. A standalone MongoDB instance without replica set support will fail transaction operations.

---

## 2. Local Development Setup

To run CareerOS locally without Docker containers:

### 2.1 Install Dependencies
Run clean installs for both root frontend and backend:
```bash
# Install root (frontend) dependencies
npm ci

# Install server (backend) dependencies
npm --prefix server ci
```

### 2.2 Configure Local Environment Variables
Create the local environment files from their committed templates:
```bash
# Frontend configuration
cp .env.example .env

# Backend configuration
cp server/.env.example server/.env
```
Ensure `server/.env` points to your running local MongoDB replica set:
```env
MONGODB_URI=mongodb://localhost:27017/careeros?replicaSet=rs0
JWT_SECRET=your_local_development_secret_at_least_32_characters_long
PORT=5000
CLIENT_URL=http://localhost:5173
```

### 2.3 Run Test & Verification Suites
```bash
# Run Vitest test suite (in-memory MongoDB ReplSet)
npm test

# Run Oxlint / ESLint linter
npm run lint

# Run Vite production build test
npm run build

# Run verification gates
npm run verify:phase10a
npm run verify:phase10b
```

### 2.4 Start Development Servers
In separate terminal sessions:
```bash
# Terminal 1: Backend API
npm --prefix server run dev

# Terminal 2: Frontend Client
npm run dev
```

---

## 3. Environment Configuration

CareerOS enforces deterministic environment separation between the browser client and server runtime.

### 3.1 Frontend (`.env` / `.env.production`)
- `.env.example`: Committed root template.
- `VITE_API_URL`: Base URL for API requests.
  - In local development: `http://localhost:5000`
  - In Docker / unified production: `/api` (or fully-qualified URL behind TLS)

### 3.2 Backend (`server/.env`)
- `server/.env.example`: Committed backend template.

#### Required Environment Variables
| Variable | Description | Production Example |
|:---|:---|:---|
| `PORT` | HTTP port for the Express API server. | `5000` |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`). | `production` |
| `MONGODB_URI` | Replica Set connection string. | `mongodb+srv://user:pass@cluster.mongodb.net/careeros` |
| `JWT_SECRET` | Cryptographic secret for signing JWT access tokens (>= 32 chars). | *Cryptographically generated 64-char hex string* |
| `CLIENT_URL` | Allowed origin for CORS validation. | `https://app.careeros.app` |

#### Optional / Hardened Variables
| Variable | Default | Purpose |
|:---|:---|:---|
| `TRUST_PROXY` | `false` | Reverse proxy trust configuration (`1`, `true`, `loopback`, or CIDR list). Set to `1` when behind Nginx or AWS ALB. |
| `DOCKER_MONGODB_URI` | `""` | Docker Compose override URI (e.g. `mongodb://host.docker.internal:27017/careeros?directConnection=true` for local host DB testing). |
| `DB_MAX_RETRIES` | `5` | Startup connection retry attempts before terminating. |
| `DB_INITIAL_DELAY_MS` | `1000` | Initial exponential backoff delay in milliseconds. |
| `DB_MAX_DELAY_MS` | `10000` | Maximum retry backoff delay. |
| `RATE_LIMIT_MAX` | `1000` | General request threshold per 15-minute window. |
| `AUTH_RATE_LIMIT_MAX` | `100` | Authentication endpoint threshold per 15-minute window. |
| `REMINDER_POLL_INTERVAL_MS`| `60000` | Reminder background worker cycle interval. |
| `INGESTION_INTERVAL_MINUTES`| `60` | Ingestion background worker cycle interval. |
| `ADZUNA_APP_ID` / `KEY` | `""` | External job board API credentials (keep empty when disabled). |

### 3.3 Secret Handling Guidelines
- **NEVER** commit `.env` or `server/.env` files to Git. Both are strictly excluded in `.gitignore`.
- **NEVER** bake credentials or tokens into Docker image layers or Dockerfiles.
- In production, inject secrets dynamically via orchestrator environment mechanisms (e.g., Kubernetes Secrets, AWS Secrets Manager, Docker Swarm secrets, or deployment platform variables).

---

## 4. Docker Startup & Container Orchestration

The containerized stack consists of 4 deterministic microservices managed via `docker-compose.yml`.

### 4.1 Exact Startup Commands
To build and run all services in detached mode:
```bash
# Build container images
docker compose --env-file server/.env build

# Start containers in background
docker compose --env-file server/.env up -d
```

### 4.2 Verifying Container Status
```bash
docker compose --env-file server/.env ps
```
All services should report `Up` and `(healthy)`:
- `careeros-api`: Running internal on port 5000.
- `careeros-frontend`: Running and mapped to host port 3000 (`3000:80`).
- `careeros-reminder-worker`: Running background polling.
- `careeros-ingestion-worker`: Running scheduled ingestion cycles.

### 4.3 Viewing Service Logs
```bash
# Stream all logs
docker compose --env-file server/.env logs -f

# Inspect worker logs
docker compose --env-file server/.env logs --tail=100 reminder-worker
docker compose --env-file server/.env logs --tail=100 ingestion-worker
```

### 4.4 Exact Shutdown Command
To gracefully terminate and clean up containers and networks:
```bash
docker compose --env-file server/.env down --remove-orphans
```

---

## 5. Service Architecture

```
                   [ User Web Browser ]
                             │
                             ▼ HTTP (Port 3000)
              ┌─────────────────────────────┐
              │      careeros-frontend      │
              │  (Nginx 1.27-alpine Ingress)│
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    Static Assets / SPA               /api/* & /health/*
   (Vite Dist Bundle)              (Internal HTTP Proxy)
                                            │
                                            ▼ (Port 5000 - Internal Network Only)
                               ┌─────────────────────────────┐
                               │        careeros-api         │
                               │   (Node 20-alpine Express)  │
                               └──────────────┬──────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
      ┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
      │     careeros-api         │ │ careeros-reminder-worker │ │careeros-ingestion-worker │
      │  (Mongoose Connection)   │ │  (Mongoose Connection)   │ │  (Mongoose Connection)   │
      └─────────────┬────────────┘ └────────────┬─────────────┘ └────────────┬─────────────┘
                    │                           │                            │
                    └───────────────────────────┼────────────────────────────┘
                                                ▼
                                  ┌──────────────────────────┐
                                  │      MongoDB Cluster     │
                                  │   (Replica Set Enabled)  │
                                  └──────────────────────────┘
```

1. **`careeros-frontend`**: Nginx web server acting as the single public entrypoint. Serves pre-built static client assets and proxies `/api/*` and `/health/*` to the internal API container.
2. **`careeros-api`**: Stateless Express.js HTTP API running in Node 20 LTS as non-root user `node`.
3. **`careeros-reminder-worker`**: Dedicated background service for processing calendar notification schedules and application deadlines.
4. **`careeros-ingestion-worker`**: Dedicated background service for batching opportunity ingestion cycles.
5. **`MongoDB Cluster`**: External managed MongoDB replica set (e.g., MongoDB Atlas).

---

## 6. Networking & Boundary Security

- **Host Port Exposure**: Only host port `3000` is exposed to the outside world, mapped to port `80` of the `careeros-frontend` container.
- **Internal API Isolation**: Port `5000` on `careeros-api` is **NOT published to the host**. It is only reachable within Docker's isolated bridge network (`default`).
- **Nginx Reverse Proxy**:
  - Ingress traffic to `/api/*` is proxied to `http://api:5000/api/*`.
  - Ingress traffic to `/health/*` is proxied to `http://api:5000/health/*`.
  - `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers are injected.
- **`TRUST_PROXY=1`**: Configured in `careeros-api` to instruct Express and `express-rate-limit` to trust the immediate upstream Nginx hop for accurate client IP identification and rate limiting.

---

## 7. Health & Readiness Probes

CareerOS provides decoupled health endpoints designed for container orchestrators, load balancers, and monitoring agents:

### 7.1 Liveness Probe (`GET /health/live`)
- **Purpose**: Checks whether the Node.js Express process is running and accepting event loop cycles.
- **Behavior**: Completely decoupled from database connectivity. Does not execute database queries.
- **Response**: HTTP 200 OK
  ```json
  {
    "success": true,
    "status": "alive",
    "message": "CareerOS API process is alive"
  }
  ```

### 7.2 Readiness Probe (`GET /health/ready`)
- **Purpose**: Checks whether the API service is ready to accept user traffic (evaluates MongoDB connection state).
- **Behavior**:
  - When MongoDB `readyState === 1`: HTTP 200 OK
    ```json
    {
      "success": true,
      "status": "ready",
      "message": "CareerOS API is ready",
      "database": "connected"
    }
    ```
  - When MongoDB disconnected: HTTP 503 Service Unavailable
    ```json
    {
      "success": false,
      "status": "not_ready",
      "message": "CareerOS API is not ready",
      "database": "disconnected"
    }
    ```

### 7.3 Legacy API Health (`GET /api/health`)
- **Purpose**: Backward-compatible route for frontend checks and legacy monitoring.
- **Response**: HTTP 200 OK (or 503 if disconnected)
  ```json
  {
    "success": true,
    "message": "CareerOS API is running",
    "database": "connected"
  }
  ```

---

## 8. Graceful Shutdown & Process Lifecycle

CareerOS implements an orderly lifecycle coordinator (`server/src/utils/shutdown.js`):

1. **Signal Handling**: Catches `SIGTERM` (Docker stop / Kubernetes termination) and `SIGINT` (Ctrl+C).
2. **Double-Signal Guard**: Ensures multiple signals trigger immediate emergency exit.
3. **HTTP Server Teardown**: Closes the active HTTP server to stop accepting new requests, while allowing in-flight requests to finish.
4. **Database Teardown**: Gracefully drains and closes Mongoose connections.
5. **Safety Timeout**: Enforces a strict 10-second bounded timeout to prevent hanging zombie processes.
6. **Unhandled Errors**: `uncaughtException` and `unhandledRejection` handlers log error context safely before executing graceful termination.

---

## 9. Continuous Integration (CI) Pipeline

CareerOS uses a hardened GitHub Actions workflow (`.github/workflows/ci.yml`):

- **Triggers**: Runs on `push` to `main` and `pull_request` to `main`.
- **Concurrency**: Cancels stale in-progress runs on newer commits.
- **Permissions**: Hardened to minimal `contents: read`.
- **Node LTS**: Standardized on Node.js 20 LTS with npm dependency caching.
- **Gates Verified**:
  1. `npm ci` (Root clean dependency installation)
  2. `npm --prefix server ci` (Backend clean dependency installation)
  3. `npm run lint` (Oxlint / ESLint code quality audit)
  4. `npm test` (Full Vitest suite of 33 test files / 698 tests against in-memory MongoDB replica set)
  5. `npm run build` (Vite production bundle compilation)
- **Zero Secrets Required**: The CI pipeline is fully self-contained and does not require third-party credentials or live external APIs.

---

## 10. External Integrations Status

To maintain deterministic and reliable operations:
- **Adzuna Job Ingestion Adapter**: Remains disabled until valid API credentials (`ADZUNA_APP_ID` and `ADZUNA_APP_KEY`) are configured.
- **Worker Behavior**: Ingestion worker safely handles the zero-enabled-source state without crashing, logging `No enabled sources found` and awaiting the next scheduled cycle.

---

## 11. Production Deployment Recommendations

When deploying CareerOS to production environments (e.g., AWS ECS, GCP Cloud Run, Kubernetes, DigitalOcean, or Render):

1. **TLS / SSL Termination**:
   - Terminate TLS at the external Load Balancer / Cloud Ingress (e.g., AWS ALB, Cloudflare, or Traefik).
   - Ensure forwarded headers (`X-Forwarded-Proto: https`) are delivered to the frontend Nginx ingress.
2. **Production Database**:
   - Deploy MongoDB as a managed, high-availability cluster (such as MongoDB Atlas M10+).
   - Set up network VPC peering or strict IP allowlisting between your container cluster and MongoDB.
3. **Environment Injection**:
   - Inject `JWT_SECRET` (generated via `openssl rand -hex 32`) and `MONGODB_URI` securely.
   - Do NOT commit environment files into container images or Git.
4. **Horizontal Scaling**:
   - The API is stateless and can scale horizontally across multiple container instances.
   - Run a single instance of `careeros-reminder-worker` and `careeros-ingestion-worker` or use distributed locks if scaling workers.
