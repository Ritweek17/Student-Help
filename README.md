# CareerOS — Student Career & Opportunity Management Platform

CareerOS is a comprehensive, production-grade web platform designed to help students discover career opportunities, hackathons, workshops, and learning tracks, while managing applications, daily goals, notes, and calendar reminders in one unified dashboard.

---

## Architecture Overview

- **Frontend**: React 18 SPA built with Vite, Tailwind CSS, Lucide icons, and modern responsive design.
- **Backend API**: Node.js 20 LTS Express HTTP REST API secured with Helmet, CORS, and Rate Limiting.
- **Authentication**: JWT access tokens + HttpOnly rotating refresh tokens with session family revocation.
- **Workers**: Dedicated Node.js background workers for calendar reminder processing and opportunity ingestion.
- **Database**: MongoDB 7.0+ (Replica Set required for multi-document Mongoose transactions).
- **Ingress / Reverse Proxy**: Nginx 1.27-alpine serving client assets and routing `/api/*` and `/health/*`.

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js `>= 20.19.0 LTS`
- npm `>= 10.0.0`
- MongoDB `>= 7.0` (Replica Set `rs0` enabled)

### 2. Install Dependencies
```bash
npm ci
npm --prefix server ci
```

### 3. Configure Environment
```bash
cp .env.example .env
cp server/.env.example server/.env
```

### 4. Run Tests & Lint
```bash
npm test                # Full Vitest suite (33 files, 698 tests)
npm run lint            # Oxlint / ESLint check
npm run build           # Vite production bundle build
npm run verify:phase10a # Security & reliability gate
npm run verify:phase10b # Auth & session rotation gate
```

### 5. Start Development
```bash
# Terminal 1: Backend API
npm --prefix server run dev

# Terminal 2: Frontend SPA
npm run dev
```

---

## Production & Docker Deployment

CareerOS includes turnkey multi-stage Dockerfiles and a Compose orchestrator.

```bash
# Build production images
docker compose --env-file server/.env build

# Run container stack in background
docker compose --env-file server/.env up -d

# Check service health
docker compose --env-file server/.env ps

# Stop stack cleanly
docker compose --env-file server/.env down --remove-orphans
```

For complete deployment specifications, reverse proxy topology, health probes, and CI details, refer to the [Deployment Guide](DEPLOYMENT.md).

---

## Documentation

- [Deployment & Operations Guide](DEPLOYMENT.md)
- [Audit & Architectural Baseline](PHASE_10E_AUDIT.md)
