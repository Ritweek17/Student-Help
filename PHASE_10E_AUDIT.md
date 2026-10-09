# CareerOS Phase 10E — Deployment / CI / Production Readiness Audit

**Audit Date:** 2026-10-06  
**Audited Baseline:** Phase 10D Complete  
- **Test Suite:** 30 Vitest test files passing (658/658 tests)  
- **Linter:** 0 errors (oxlint)  
- **Frontend Build:** Vite production bundle succeeds (`dist/` generated)  
- **Git Status:** Clean baseline, all legacy scripts preserved  

---

## 1. Executive Summary

CareerOS has successfully modernized its test suite across Phases 10A–10D, achieving a deterministic, isolated Vitest test suite leveraging `mongodb-memory-server` and `supertest`. 

However, the repository currently lacks standard production deployment infrastructure:
- **No Docker configuration:** No `Dockerfile`, `.dockerignore`, or compose specifications exist.
- **No CI automation:** No GitHub Actions or CI pipeline exists.
- **Frontend / Backend Hosting Gap:** The frontend is a Vite React SPA that builds to `dist/`, but the Express backend does not serve static assets, nor is there a containerized web server (Nginx/Caddy) to serve the SPA and route `/api` traffic.
- **Inverted Shutdown Sequence:** In `server/src/server.js`, the database disconnects *before* the HTTP server closes, risking query aborts for in-flight requests.
- **Coarse Health Checks:** Only `GET /api/health` exists (combining liveness and readiness). If the database experiences transient latency or reconnection, the entire service reports 503 without distinction between process liveness and service readiness.
- **Proxy & IP Masking:** Express does not configure `trust proxy`, causing rate limiting and audit logging to attribute all traffic to the container reverse proxy/load balancer IP.
- **Documentation:** The project `README.md` remains the default Vite starter template.

This audit establishes the exact blueprint for Phases 10E Batches 2 through 6.

---

## 2. Current Production Startup Flow

### 2.1 Workspace Structure & Execution Modalities
The repository is structured as a two-tier monorepo without a formal package workspace tool (e.g., Turborepo/pnpm workspaces):
1. **Root Directory (`/`)**: Houses the Vite frontend (`src/`, `public/`, `index.html`, `vite.config.js`, `package.json`).
2. **Server Directory (`/server`)**: Houses the Express API and background workers (`server/src/`, `server/package.json`).

### 2.2 Startup Commands
- **Frontend Development:** `npm run dev` (`vite`) — spins up local dev server on port 5173.
- **Frontend Production Preview:** `npm run preview` (`vite preview`) — local static server.
- **Backend Development:** `npm run dev` in `server/` (`nodemon src/server.js`).
- **Backend Production:** `npm start` in `server/` (`node src/server.js`).
- **Background Workers:**
  - Reminder Worker: `npm run worker:reminders` in `server/` (`node src/workers/reminder.worker.js`).
  - Ingestion Worker: `npm run worker:ingestion` in `server/` (`node src/workers/ingestion.worker.js`).

### 2.3 Gaps in Startup Flow
- There is no unified root production start script (e.g. `npm start` at root does not exist).
- Background workers must be launched as separate independent processes. There is no process orchestration file (such as Docker Compose, supervisord, or PM2) to manage API and worker lifecycles.
- When `node src/server.js` is started outside the `server` directory (e.g. from repo root), `dotenv.config()` loads from `process.cwd()/.env`, failing to find `server/.env` unless explicitly specified.

---

## 3. Current Frontend Production Build Flow

### 3.1 Build Command & Output
- **Command:** `npm run build` (`vite build`).
- **Tools:** Vite 8.2.2, `@vitejs/plugin-react` 6.1.0, `@tailwindcss/vite` 4.0.7, React 19.2.8.
- **Output:** Built files emitted to `dist/`:
  - `dist/index.html` (entry point HTML)
  - `dist/assets/index-[hash].css` (~95 kB)
  - `dist/assets/index-[hash].js` (~676 kB)

### 3.2 Frontend API Configuration
Every frontend API client module (14 service files in `src/services/`):
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```
- **Build-Time Binding:** In Vite, `import.meta.env.VITE_*` variables are statically replaced at **compile time** (`npm run build`). Once compiled into `dist/`, the API base URL cannot be changed via container runtime environment variables without rebuilding or injecting runtime config.
- **Serving Architecture:** Vite produces a client-side SPA. In production, requests to client-side routes (e.g., `/login`, `/dashboard`, `/opportunities/123`) must fall back to `/index.html`. Currently, no Nginx configuration or Express fallback exists for this.

---

## 4. Current Backend Startup Flow

### 4.1 Entrypoint & Bootstrap Sequence
Entrypoint: `server/src/server.js`
1. **Module Import Phase:** Imports `app.js`, `config/db.js`, `config/env.js`.
2. **Environment Validation Phase:** Synchronously executed inside `env.js`:
   - Calls `dotenv.config()`.
   - Validates existence of `PORT`, `NODE_ENV`, `CLIENT_URL`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
   - Validates `PORT` range (1–65535).
   - Validates `NODE_ENV` in `['development', 'test', 'production']`.
   - Validates `CLIENT_URL` protocol (`http:` or `https:`).
   - Validates `MONGODB_URI` protocol (`mongodb:` or `mongodb+srv:`).
   - Validates `JWT_SECRET` length >= 16 characters if `NODE_ENV === 'production'`.
   - Validates integrity of optional Adzuna adapter credentials (if either `ADZUNA_APP_ID` or `ADZUNA_APP_KEY` is set, both must be provided).
3. **Database Connection Phase:** `startServer()` calls `await connectDatabase()`.
   - Retries up to `DB_MAX_RETRIES` (default: 5) with exponential backoff.
   - If DB connection completely fails after retries, logs error and terminates process with `process.exit(1)`.
4. **Listener Phase:** On DB connection success, calls `server = app.listen(env.port, ...)`.

### 4.2 Gaps in Backend Startup
- **Process Exception Listeners:** No `process.on('unhandledRejection')` or `process.on('uncaughtException')` handlers are registered in `server.js`.
- **Trust Proxy:** `app.set('trust proxy', 1)` is missing from `app.js`. In production behind a container ingress, load balancer, or reverse proxy, `req.ip` reflects the proxy rather than the client, breaking per-client rate limiting.
- **Dotenv Path Fallback:** If launched from workspace root (`node server/src/server.js`), `dotenv` defaults to root `.env`, which is absent or does not contain backend variables.

---

## 5. Current Database Connection Lifecycle

### 5.1 Architecture & Resilience (`server/src/config/db.js`)
- **DNS Server Override:** `dns.setServers(['8.8.8.8', '1.1.1.1'])` is executed at the top of `db.js`.
  - *Risk:* In Docker networks or corporate/VPC clusters with internal DNS resolvers (e.g., Docker service discovery resolving `mongo` to a container IP), overriding DNS servers to Google/Cloudflare public IPs can cause internal DNS resolutions to fail. This should only apply or be configurable if SRV resolution requires it, or preserve standard resolution for local/container hostnames.
- **Connection Logic:**
  - `connectDatabase(options)` supports configurable retries (`DB_MAX_RETRIES`, `DB_INITIAL_DELAY_MS`, `DB_MAX_DELAY_MS`, `backoffFactor`).
  - Differentiates between permanent configuration errors (`MongoParseError`, malformed URLs) which fail fast, and transient network errors which retry with exponential backoff.
- **Connection States & Probes:**
  - `isDatabaseConnected()` returns boolean based on `mongoose.connection.readyState === 1`.
  - `getDatabaseStatus()` returns `'connected' | 'connecting' | 'disconnected' | 'failed'`.
- **Teardown:** `disconnectDatabase()` disconnects cleanly if connected.

---

## 6. Current Worker Lifecycle

### 6.1 Worker Architectures
Both workers are standalone scripts intended to run as dedicated daemon processes:
1. **Reminder Worker (`server/src/workers/reminder.worker.js`):**
   - Direct execution check: `process.argv[1].endsWith('reminder.worker.js')`.
   - Connects to database at boot via `connectDatabase()`.
   - Loops via recursive `setTimeout` with `REMINDER_POLL_INTERVAL_MS` (default 60s, min 1s).
   - Executes `processDueReminders(new Date())`.
   - Graceful shutdown handles `SIGINT` / `SIGTERM`, cancels timer, waits for current cycle `isRunning` flag to clear, disconnects database, and calls `process.exit(0)`.
2. **Ingestion Worker (`server/src/workers/ingestion.worker.js`):**
   - Direct execution check: `process.argv[1].endsWith('ingestion.worker.js')`.
   - Connects to database at boot via `connectDatabase()`.
   - Loops via recursive `setTimeout` with `INGESTION_INTERVAL_MINUTES` (default 60m, min 5m).
   - Uses distributed distributed locking via `acquireSourceLock(source._id, WORKER_ID)` with 30m stale threshold.
   - Runs pipeline through registered adapters (`RemotiveAdapter`, `HasjobAdapter`, `DevpostAdapter`, `AdzunaAdapter`).
   - Graceful shutdown clears timer, waits for active batch to finish, releases resources, disconnects database, and calls `process.exit(0)`.

### 6.2 Gaps in Worker Lifecycle
- No safety timeout on worker shutdown if a cycle hangs on an external HTTP fetch or uncooperative promise.
- Workers do not trap `unhandledRejection` or `uncaughtException`.
- No health probe or liveness mechanism is exposed for worker containers.

---

## 7. Current Environment Variables Inventory

| Variable | Scope | Required | Default / Constraints | Usage |
| :--- | :--- | :---: | :--- | :--- |
| `PORT` | Backend | Yes | 1–65535 (e.g. 5000) | Express HTTP listening port |
| `NODE_ENV` | Backend | Yes | `'development' \| 'test' \| 'production'` | Execution environment mode |
| `CLIENT_URL` | Backend | Yes | Valid HTTP/HTTPS URL | CORS allowed origin & redirect references |
| `MONGODB_URI` | Backend | Yes | `mongodb:` or `mongodb+srv:` | Primary MongoDB connection string |
| `JWT_SECRET` | Backend | Yes | Min 16 chars in production | Signs authentication tokens |
| `JWT_EXPIRES_IN` | Backend | Yes | String (e.g. `'15m'`) | Access token TTL fallback |
| `ACCESS_TOKEN_EXPIRES_IN` | Backend | No | Falls back to `JWT_EXPIRES_IN` \| `'15m'` | Access token expiration |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS`| Backend | No | `7` | Refresh token document & cookie TTL |
| `REFRESH_COOKIE_NAME` | Backend | No | `'careeros_refresh_token'` | Name of HttpOnly cookie |
| `RATE_LIMIT_MAX` | Backend | No | `1000` | General API rate limit ceiling |
| `RATE_LIMIT_WINDOW_MS` | Backend | No | `900000` (15m) | General API rate limit window |
| `AUTH_RATE_LIMIT_MAX` | Backend | No | `100` | Auth endpoints rate limit ceiling |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Backend | No | `900000` (15m) | Auth endpoints rate limit window |
| `ADZUNA_APP_ID` | Backend | No* | String (*required if KEY provided) | Adzuna Job API App ID |
| `ADZUNA_APP_KEY` | Backend | No* | String (*required if ID provided) | Adzuna Job API App Key |
| `DB_MAX_RETRIES` | Backend | No | `5` | Database connection retry attempts |
| `DB_INITIAL_DELAY_MS` | Backend | No | `1000` | Exponential backoff starting delay |
| `DB_MAX_DELAY_MS` | Backend | No | `10000` | Exponential backoff ceiling |
| `REMINDER_POLL_INTERVAL_MS` | Worker | No | `60000` (min: 1000) | Reminder worker polling cadence |
| `INGESTION_INTERVAL_MINUTES` | Worker | No | `60` (min: 5) | Opportunity ingestion polling cadence |
| `VITE_API_URL` | Frontend | No | `'http://localhost:5000'` | Client API base URL (Vite build-time) |

---

## 8. Current Security-Sensitive Configuration

1. **Secrets in Git:** Verified clean. `.gitignore` properly excludes `.env`, `.env.*`, `server/.env`. No secrets exist in tracked files or Git history.
2. **JWT Secret Hardening:** `env.js` validates that `JWT_SECRET` is at least 16 characters in production. (Recommended: 32+ characters for SHA-256 HMAC in production deployment docs).
3. **Cookie Security:**
   - In `auth.service.js`:
     ```javascript
     {
       httpOnly: true,
       secure: env.nodeEnv === 'production',
       sameSite: env.nodeEnv === 'production' ? 'strict' : 'lax',
       path: '/api/auth',
       maxAge: env.auth.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000
     }
     ```
   - **Cross-Domain Warning:** If frontend and backend are deployed across different domains in production (e.g., `app.careeros.com` vs `api.careeros.com`), `sameSite: 'strict'` prevents the refresh cookie from being sent with cross-site `fetch` requests. Deployments must either be co-located behind a single domain/reverse-proxy (e.g., `careeros.com` and `careeros.com/api`) or configure `sameSite: 'none'` with `secure: true`.
4. **CORS:** Restricts `origin` strictly to `env.clientUrl` with `credentials: true`.
   - *Trailing Slash Pitfall:* If `CLIENT_URL` is set to `http://localhost:5173/` (with trailing slash), browsers sending origin `http://localhost:5173` will be rejected by Express CORS. `CLIENT_URL` should be stripped of trailing slashes during validation or origin normalization.
5. **Rate Limiting & Helmet:**
   - Helmet is mounted with cross-origin resource policy enabled.
   - `express-rate-limit` is configured for `/api` and `/api/auth`.
   - *Missing Trust Proxy:* Express lacks `app.set('trust proxy', 1)`.

---

## 9. Current Missing Deployment Infrastructure

1. **Docker / Containerization:**
   - No `Dockerfile` for backend or frontend.
   - No `.dockerignore` to prevent uploading `node_modules`, test databases, `.env`, or build artifacts.
   - No `docker-compose.yml` for unified local stack orchestration or staging environments.
2. **Health & Readiness Architecture:**
   - Existing endpoint `GET /api/health` checks MongoDB connection and returns 200 or 503.
   - Missing dedicated `/health/live` (or root liveness) for container orchestrators (Kubernetes/ECS/Docker) to determine if process is responsive.
   - Missing dedicated `/health/ready` that verifies database readiness and active shutdown state.
3. **Graceful Shutdown Deficiencies:**
   - In `server/src/server.js`:
     ```javascript
     await disconnectDatabase();
     await closeServer;
     ```
     The database is disconnected *before* the HTTP listener finishes closing, immediately terminating active database queries for in-flight requests.
   - No graceful shutdown timeout: if an HTTP client keeps an active connection alive, `server.close()` hangs indefinitely.
4. **CI Pipeline:**
   - No `.github/workflows/` directory.
   - No automated execution of linting, test suite, and production build on pull request or push.
5. **Production Documentation:**
   - No instructions explaining how to deploy, configure environment variables, run containers, or initialize the database.

---

## 10. Containerization Architecture Analysis

### Options: Separate vs. Combined Containers
- **Option A: Separate Containers (Recommended for standard microservice/cloud setups):**
  - **Backend Container:** Runs Node.js Express server (`server/src/server.js`) on alpine/slim image.
  - **Worker Container:** Same image, different CMD (`node src/workers/...`).
  - **Frontend Container:** Multi-stage build producing static files served by high-performance Nginx with SPA `try_files` fallback and `/api` reverse proxy.
  - *Pros:* Decoupled scaling, static assets served via Nginx rather than Node.js event loop, optimal caching headers.
- **Option B: Unified Container (App + Built Frontend):**
  - Multi-stage build that compiles Vite frontend to `dist/`, copies it to the backend container, and Express serves static files via `express.static` with SPA fallback.
  - *Pros:* Single container deployment, zero CORS configuration needed, simpler for low-resource single-server instances (Render, Railway, VPS).
  - *Cons:* Node.js serves static files; mixes frontend compilation into backend container.

### Decision for CareerOS:
To support clean production deployment, we will provide:
1. A **Production Backend Dockerfile** (`server/Dockerfile` or root multi-stage Dockerfile) tailored for running the Express API and background workers.
2. A **Production Frontend Dockerfile** (Nginx-based) for serving static assets and optionally proxying `/api`.
3. A **Production Docker Compose** configuration linking Frontend, Backend, and documentation for connecting an external or managed MongoDB.

---

## 11. Current Blockers

There are **zero blocking architectural flaws**, but the following items require attention during Batches 2–6:
1. **Shutdown Inversion:** Fix shutdown ordering in `server/src/server.js` (close HTTP server -> drain connections -> disconnect database).
2. **Graceful Shutdown Timeout:** Add a safety timeout (e.g. 10s) to force process exit if in-flight connections hang during shutdown.
3. **Trailing Slash in CLIENT_URL:** Sanitize `CLIENT_URL` to strip trailing slashes so CORS doesn't reject valid browser origins.
4. **Trust Proxy Configuration:** Enable `app.set('trust proxy', 1)` in production so `req.ip` correctly attributes client requests behind proxies.
5. **Health vs. Readiness Endpoints:** Introduce distinct liveness and readiness checks (`/health/live`, `/health/ready`, and keep backward-compatible `/api/health`).
6. **DNS Server Override in Docker:** Ensure `dns.setServers` in `db.js` does not break container-to-container internal hostnames.

---

## 12. Recommended Implementation Order

### Batch 2 — Environment & Production Config
- Update and harden `server/src/config/env.js`:
  - Sanitize `CLIENT_URL` (strip trailing slash).
  - Add optional `TRUST_PROXY` configuration.
  - Ensure clear separation of dev, test, and production configs.
- Provide comprehensive `.env.example` in repo root and `server/.env.example`.
- Document all environment variables.
- Gate: `npm test`, `npm run lint`, `npm run build` pass; valid/invalid env tests pass.

### Batch 3 — Docker / Containerization
- Create `.dockerignore` for root and server.
- Create production Dockerfile for backend.
- Create production Dockerfile with Nginx for frontend.
- Create `docker-compose.yml` for unified local/production-like containerization.
- Gate: Docker build succeeds, container starts and boots cleanly, no secrets leaked into image layers.

### Batch 4 — Health + Graceful Shutdown
- Enhance health routing:
  - Add `/health/live` (liveness probe).
  - Add `/health/ready` (readiness probe checking DB status and shutdown state).
  - Maintain backward compatibility for `/api/health`.
- Fix shutdown sequence in `server/src/server.js`:
  - 1. Stop accepting new traffic (`server.close()`).
  - 2. Drain active connections with safety timeout (10s).
  - 3. Disconnect database cleanly (`disconnectDatabase()`).
  - 4. Exit 0.
- Register `unhandledRejection` and `uncaughtException` listeners in `server.js` and workers.
- Add unit/integration tests for health and shutdown behaviors.
- Gate: `npm test`, `npm run lint`, `npm run build` pass.

### Batch 5 — CI Pipeline
- Create `.github/workflows/ci.yml`.
- Configure jobs for:
  - Dependency installation (`npm ci`).
  - Linter (`npm run lint` — oxlint).
  - Test suite (`npm test` — Vitest with `mongodb-memory-server`).
  - Production build (`npm run build` — Vite).
- Verify pipeline is 100% offline, isolated, and deterministic.
- Gate: CI workflow validation passes.

### Batch 6 — Final Production Verification & Documentation
- End-to-end verification of clean checkout, clean install, Docker build, and container boot.
- Create comprehensive `DEPLOYMENT.md` and update `README.md`.
- Final audit and verification report.
