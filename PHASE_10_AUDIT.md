# CAREEROS — PHASE 10: TESTING MODERNIZATION + PRODUCTION HARDENING READINESS AUDIT

## 1. Executive Summary
CareerOS has successfully laid out a robust, scalable foundation (Phases 1-9) with strict Mongoose schemas, isolated domain models, and a functional React SPA. However, the current infrastructure relies heavily on custom, script-based verifications that demand a live MongoDB Replica Set. The architecture lacks standardized testing, defensive containerization, production-grade security middleware, and resilient environment validation. This audit defines the exact roadmap to harden the platform for staging and production release.

---

## 2. Current Testing Architecture & 3. Custom Verification Audit
The project currently uses bespoke Node.js scripts (e.g., `verify-auth.js`, `verify-learning-api.js`) that manually spin up an Express listener and issue HTTP requests. 

**Risks with Current Approach:**
- **State Leakage:** If an `assert()` fails midway, the `finally` block is often skipped or fails, leaving dirty test data in the local database.
- **Dependency on Replica Sets:** Tests mandate a live `rs0` replica set, hindering simple CI integration.
- **Sequential Bottlenecks:** Tests are purely sequential and lack parallelization, reducing developer feedback velocity.

**Categorization of Scripts:**
- *End-to-End API Integration:* `verify-auth.js`, `verify-learning-api.js`, `verify-tracker-api.js`, etc. (Should become Integration Tests).
- *Static/Schema Checks:* `verify-ingestion-schema.js` (Should become Unit Tests).
- *Network/Infrastructure:* `verify-adzuna-adapter.js` (Should remain isolated infrastructure checks, not run in standard CI without mocking).

---

## 4. Recommended Test Framework: Vitest
**Recommendation:** **Vitest** is the optimal choice for this repository.
- **Why?** The frontend already utilizes Vite. Vitest seamlessly integrates with Vite's configuration and provides out-of-the-box, first-class ESM (ECMAScript Modules) support for Node.js 24, bypassing the notorious configuration struggles Jest has with `"type": "module"`.
- **Migration Strategy:** The custom `verify-*.js` logic translates almost 1:1 into Vitest's `describe/it` blocks. We can pair Vitest with `mongodb-memory-server` and `supertest` to run isolated API integration tests without requiring a host MongoDB daemon.

---

## 5. Backend & 6. Frontend Testing Gaps
| Module | Status | Missing / Needs Migration |
| :--- | :---: | :--- |
| **Auth** | 🟡 | E2E passes, but needs Unit Tests for JWT utilities and Refresh lifecycle. |
| **Opportunities** | 🟡 | Schema tests exist; needs API endpoint Unit Tests. |
| **Learning/Contests** | 🟡 | E2E passes; needs Unit Tests for Service layer aggregations. |
| **Frontend Auth Context** | 🔴 | No tests for token expiration, restoration, or React Router protected boundaries. |
| **Frontend API Clients** | 🔴 | Need MSW (Mock Service Worker) tests for HTTP failures (401, 404, 500). |

---

## 7. Security Findings
- **P0: Session Expiry Trap:** JWTs expire in 15 minutes, but there is no Refresh Token rotation strategy. Users will be jarringly logged out while actively working.
- **P1: Missing HTTP Security Headers:** `helmet` is not installed or mounted.
- **P1: Token Storage:** JWT is stored in `sessionStorage` (XSS vulnerable) instead of HTTP-only cookies.
- **P1: Missing Rate Limiting:** `express-rate-limit` is in `package.json` but is completely absent from `app.js`.

---

## 8. Environment / Secrets Findings
- **P1: Incomplete Startup Validation:** `server/src/config/env.js` rigorously validates core variables, but ignores source adapter credentials (e.g., `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`). A missing API key will cause the ingestion worker to crash at runtime rather than failing fast at boot.

---

## 9. Database Safety Findings
- **P1: Immediate Crash on DB Outage:** `connectDatabase()` inside `db.js` lacks retry logic or exponential backoff. If the DB container takes 5 seconds longer to boot than the Node container, the Express server immediately crashes (`process.exit(1)`).

---

## 10. API Reliability Findings
- **P1: Silent Error Swallowing in Production:** `server/src/middleware/errorHandler.js` returns a sanitized "Internal server error" in production (Good), but it completely fails to `console.error(error)` the actual stack trace (Bad). Production bugs will be invisible.

---

## 11. Worker/Ingester Findings
- **P2: Unhandled Rejections:** `ingestion.worker.js` gracefully handles `SIGTERM`/`SIGINT`, but lacks `process.on('uncaughtException')` or `unhandledRejection` handlers. A detached rogue Promise could silently crash the process without triggering the DB disconnection cleanup.

---

## 12. Observability Findings
- **P2: Correlation IDs:** Requests lack `x-request-id` tracking, making it nearly impossible to trace a user request from the Express router down to a specific Mongoose query failure in logs.
- **P2: Structured Logging:** The app relies on raw `console.log`. Needs a lightweight structured logger (e.g., Pino or Winston) for production observability.

---

## 13. Deployment & 14. CI/CD Findings
- **P0: No Containerization:** Missing `Dockerfile` and `docker-compose.yml`. 
- **P1: No Process Management:** Missing PM2 ecosystem config.
- **P1: CI Void:** No GitHub Actions workflows exist to enforce formatting, linting, or testing before merges.

---

## 15. Performance Findings
- **P2: Frontend Unbounded Queries:** Some UI views request unbounded lists (e.g., Admin tables) without utilizing the backend's pagination logic.

---

## 16. P0/P1/P2 Priority Matrix

| Priority | Area | Problem | Recommended Fix | Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | Security/Auth | No Refresh Tokens; 15m JWT expiry logs users out. | Implement Refresh Token rotation & HTTP-Only cookies. | High |
| **P0** | Deployment | Missing containerization limits staging tests. | Write `Dockerfile` and `docker-compose.yml`. | Low |
| **P1** | Testing | Tests require live replica set. | Install Vitest + `mongodb-memory-server`. | Medium |
| **P1** | Database | Server crashes if DB is not ready at boot. | Add connection retries / exponential backoff in `db.js`. | Low |
| **P1** | API | Error handler drops logs in production. | Add `console.error` to `errorHandler.js`. | Low |
| **P1** | Security | Rate limiting and Helmet missing. | Mount `helmet` and `express-rate-limit` in `app.js`. | Low |
| **P1** | Environment | Missing validation for adapter secrets. | Add Adzuna/Devpost key validation to `env.js`. | Low |
| **P2** | Observability | No Request IDs or structured logs. | Add middleware injecting UUIDs and migrate to Pino. | Medium |

---

## 17. Proposed Phase 10 Roadmap

- **Phase 10A: Security & Reliability Hardening**
  - Implement Rate Limiting, Helmet, Error Logger, DB Retries, and Env Validation.
- **Phase 10B: Authentication Modernization (HTTP-Only & Refresh)**
  - Migrate JWT from `sessionStorage` to HTTP-only cookies; add Refresh Token rotation.
- **Phase 10C: Testing Framework Migration**
  - Install Vitest, `supertest`, and `mongodb-memory-server`. Migrate `verify-auth.js` to Vitest to prove the architecture.
- **Phase 10D: Full Test Suite Migration**
  - Migrate all remaining `verify-*.js` scripts to Vitest integration tests.
- **Phase 10E: Deployment & CI Pipeline**
  - Create `Dockerfile`, `docker-compose.yml`, and GitHub Actions CI workflow.

---

## 18. Production Quality Gate
CareerOS will be considered "Production Ready" ONLY when:
1. **Testing:** Vitest covers 100% of domain APIs using `mongodb-memory-server` in CI.
2. **Security:** Refresh tokens ensure uninterrupted sessions, and HttpOnly cookies protect against XSS.
3. **Database:** Node gracefully retries connections on boot.
4. **API:** Rate limits and `helmet` headers are actively enforced.
5. **Deployment:** The system boots deterministically using a single `docker-compose up` command.

---

## 19. Files Touched per Phase (Preview)
- **10A:** `app.js`, `db.js`, `env.js`, `errorHandler.js`
- **10B:** `auth.service.js`, `auth.controller.js`, `AuthContext.jsx`, `authApi.js`
- **10C:** `package.json`, `vite.config.js`, `tests/setup.js`, `tests/auth.test.js`
- **10D:** `tests/*.test.js`, deleting `scripts/verify-*.js`
- **10E:** `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`

## 20. Risks and Dependencies
- **Risk:** Migrating to HttpOnly cookies (Phase 10B) requires configuring `credentials: 'include'` on the frontend `fetch` and adjusting `cors` settings on the backend, which is prone to environment-specific bugs during local development.
- **Dependency:** Phase 10D depends heavily on the success of 10C's `mongodb-memory-server` setup to ensure replica-set transaction features (vital for Auth) work natively in CI.
