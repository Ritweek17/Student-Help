# CareerOS Environment & Configuration Guide

This document details the environment configuration architecture for the CareerOS platform across development, test, and production environments.

---

## 1. Quick Reference: Required vs. Optional Variables

### Backend Configuration (`server/.env`)

| Variable | Required | Default / Format | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | **Yes** | Integer `1–65535` | Listening port for the Express HTTP server (e.g. `5000`). |
| `NODE_ENV` | **Yes** | `development` \| `test` \| `production` | Execution mode. Controls error sanitization, cookie policies, and validation strictness. |
| `CLIENT_URL` | **Yes** | Valid `http:` or `https:` URL | Allowed CORS origin. Trailing slashes are automatically stripped during boot. |
| `MONGODB_URI` | **Yes** | `mongodb://` or `mongodb+srv://` | MongoDB connection string. Must point to a replica-set-enabled cluster. |
| `JWT_SECRET` | **Yes** | String (min 16 chars in prod) | Cryptographic secret for signing JWT access tokens (32+ chars recommended in prod). |
| `JWT_EXPIRES_IN` | **Yes** | String (e.g. `15m`, `1h`) | Access token TTL fallback. |
| `ACCESS_TOKEN_EXPIRES_IN` | No | Falls back to `JWT_EXPIRES_IN` \| `15m` | Access token lifespan. |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | No | `7` | Refresh token document and cookie TTL (in days). |
| `REFRESH_COOKIE_NAME` | No | `careeros_refresh_token` | Name of the HttpOnly refresh token cookie. |
| `TRUST_PROXY` | No | `false` | Reverse proxy trust configuration (`false`, `1`, `loopback`, or CIDR/IP list). |
| `RATE_LIMIT_MAX` | No | `1000` | Max requests per rate limit window for general `/api` routes. |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Rate limit window duration in milliseconds. |
| `AUTH_RATE_LIMIT_MAX` | No | `100` | Max requests per rate limit window for `/api/auth` endpoints. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Auth rate limit window duration in milliseconds. |
| `DB_MAX_RETRIES` | No | `5` | Maximum database connection attempts on startup. |
| `DB_INITIAL_DELAY_MS` | No | `1000` | Starting backoff delay in milliseconds. |
| `DB_MAX_DELAY_MS` | No | `10000` | Maximum backoff delay ceiling in milliseconds. |
| `REMINDER_POLL_INTERVAL_MS`| No | `60000` (min: 1000) | Polling frequency for the reminder background worker. |
| `INGESTION_INTERVAL_MINUTES`| No | `60` (min: 5) | Polling frequency for the opportunity ingestion worker. |
| `ADZUNA_APP_ID` | No* | String | Adzuna API App ID (*both ID and Key must be provided if either is set). |
| `ADZUNA_APP_KEY` | No* | String | Adzuna API App Key (*both ID and Key must be provided if either is set). |

### Frontend Configuration (`.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | No | `http://localhost:5000` | Base URL of the CareerOS backend API (compiled into JS bundle at build time). |

---

## 2. Environment Matrix: Development vs. Test vs. Production

| Concern | Development (`development`) | Test (`test`) | Production (`production`) |
| :--- | :--- | :--- | :--- |
| **Error Stacks** | Returned in API JSON & logged | Returned in test assertions | Omitted from API JSON; 5xx logged to server with credentials redacted. |
| **JWT Secret Length** | Any non-empty string allowed | Any non-empty string allowed | Strictly enforced: must be ≥ 16 characters. |
| **Cookie Security** | `secure: false`, `sameSite: 'lax'` | `secure: false`, `sameSite: 'lax'` | `secure: true`, `sameSite: 'strict'` (or `'none'` for cross-domain). |
| **Database** | Local MongoDB (`rs0`) | In-memory replica set (`mongodb-memory-server`) | Managed MongoDB Replica Set (e.g. MongoDB Atlas). |
| **Reverse Proxy** | `TRUST_PROXY=false` | `TRUST_PROXY=false` | `TRUST_PROXY=1` (or explicit proxy IP/CIDR). |

---

## 3. Reverse Proxy Configuration (`TRUST_PROXY`)

In production, CareerOS typically sits behind a reverse proxy, load balancer, or container ingress (e.g. Nginx, AWS ALB, Cloudflare, Render):

- **Problem:** If Express does not trust the proxy, `req.ip` reflects the proxy's IP address rather than the client's. This causes `express-rate-limit` to rate limit all users under a single IP bucket.
- **Solution:** Configure `TRUST_PROXY`:
  - `TRUST_PROXY=1` or `TRUST_PROXY=true`: Trusts the first hop (the immediate front-facing reverse proxy). The rightmost IP in `X-Forwarded-For` is treated as the client IP.
  - `TRUST_PROXY=loopback`: Trusts connections coming from `127.0.0.1` or `::1` (useful for local Nginx sidecars).
  - `TRUST_PROXY=10.0.0.0/8, 172.16.0.0/12`: Explicit subnet trust.
  - `TRUST_PROXY=false`: Disables proxy trust (default for local development without proxies).

> **Security Note:** CareerOS parses `TRUST_PROXY=true` to `1` hop to avoid blindly trusting arbitrary upstream hops, preventing spoofed `X-Forwarded-For` headers from bypassing rate limits.

---

## 4. Frontend API URL Behavior (`VITE_API_URL`)

- The frontend is a Single Page Application (SPA) built with Vite.
- All 14 API services in `src/services/` reference:
  ```javascript
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  ```
- **Build-Time Inlining:** In Vite, variables prefixed with `VITE_` are inlined into the client bundle at `npm run build` time. They **cannot** be read from container environment variables at runtime.
- For production:
  - If frontend and backend are hosted behind the same domain/reverse-proxy (e.g., Nginx routing `/api` to Express and `/` to static files), set `VITE_API_URL=/api` or leave blank with root proxying.
  - If frontend and backend are on separate domains, set `VITE_API_URL=https://api.careeros.app` during build.

---

## 5. Security & Secret Exposure Boundary

### Safe for Frontend Builds:
- **ONLY** variables prefixed with `VITE_` (e.g., `VITE_API_URL`).
- Never put API secrets, database credentials, or JWT signing keys in `.env` at the root without realizing they become publicly inspectable in client JavaScript bundles.

### Strictly Backend Secrets (NEVER expose to frontend):
- `JWT_SECRET`
- `MONGODB_URI`
- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`
- Any future third-party adapter secrets

---

## 6. External Adapter Credential Behavior

CareerOS supports optional third-party opportunity source adapters (e.g., Adzuna):
- **Disabled State:** If neither `ADZUNA_APP_ID` nor `ADZUNA_APP_KEY` is provided, CareerOS boots cleanly without errors. The adapter remains disabled.
- **Partial Configuration:** If only one of `ADZUNA_APP_ID` or `ADZUNA_APP_KEY` is provided, startup immediately fails fast with a descriptive error:
  `Malformed Adzuna configuration: both ADZUNA_APP_ID and ADZUNA_APP_KEY must be provided if either is set`.
- **Runtime Invocation:** If ingestion attempts to fetch from Adzuna while credentials are not configured, `validateIntegrationCredentials('adzuna')` throws a clear error rather than issuing unauthenticated requests.
