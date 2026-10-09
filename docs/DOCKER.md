# CareerOS Docker & Containerization Guide

This document explains the production containerization architecture and deployment instructions for CareerOS.

---

## 1. Architecture Overview

CareerOS uses a decoupled multi-container production architecture separating the user interface, HTTP API, and background workers into independent container services:

```
[ Browser / Client ]
         │
         ▼
[ careeros-frontend ] (Nginx 1.27 Alpine on port 80 / mapped to host :3000)
    ├─ Static Assets: Serves compiled React 19 SPA (dist/) with gzip & immutable caching
    ├─ SPA Routing:   Falls back to /index.html for client-side routing
    └─ Reverse Proxy: Proxies /api/ requests directly to careeros-api:5000
         │
         ▼
[ careeros-api ] (Node.js 20 Alpine on port 5000 / internal network only)
    └─ Express API: Evaluates auth, validates schemas, executes domain business logic
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
[ careeros-reminder-worker ]             [ careeros-ingestion-worker ]
(Node.js 20 background daemon)           (Node.js 20 background daemon)
    └─ Polls due calendar reminders          └─ Ingests opportunities from enabled sources
         │                                          │
         └────────────────────┬─────────────────────┘
                              ▼
                 [ External MongoDB Cluster ]
                 (Managed Replica Set / Atlas)
```

> **Note on MongoDB:** In accordance with production best practices, MongoDB is **not** bundled into the application containers. It remains an external service connected via `MONGODB_URI`.

---

## 2. Container Images

### 2.1 Frontend Container (`Dockerfile`)
- **Stage 1 (Builder):** Uses `node:20-alpine` to install dependencies and run `npm run build` (`vite build`).
- **Stage 2 (Runner):** Uses `nginx:1.27-alpine` to serve static files.
- **Port:** `80`.
- **Build Argument:** `ARG VITE_API_URL=/api` (routes API calls through the internal Nginx reverse proxy).

### 2.2 Backend API & Worker Container (`server/Dockerfile`)
- **Stage 1 (Dependencies):** Uses `node:20-alpine` to install production dependencies (`npm ci --omit=dev`).
- **Stage 2 (Runner):** Uses `node:20-alpine`, copies `node_modules` and `src/`, sets `NODE_ENV=production`, and runs as non-root user `USER node`.
- **Default Entrypoint:** Starts the API server (`node src/server.js`).
- **Worker Entrypoints:** Overridden via container command:
  - Reminder Worker: `node src/workers/reminder.worker.js`
  - Ingestion Worker: `node src/workers/ingestion.worker.js`

---

## 3. Building Images Locally

### Build Backend Image
```bash
docker build -t careeros-backend ./server
```

### Build Frontend Image
```bash
docker build -t careeros-frontend --build-arg VITE_API_URL=/api .
```

### Build Entire Stack via Compose
```bash
docker compose build
```

---

## 4. Running the Application Stack

### Using Docker Compose
1. Ensure `server/.env` is configured (or export environment variables):
   ```bash
   # In server/.env:
   # For Atlas cloud cluster:
   # MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/careeros?retryWrites=true&w=majority"
   #
   # For local host MongoDB from Docker on Mac/Linux:
   # DOCKER_MONGODB_URI="mongodb://host.docker.internal:27017/careeros?directConnection=true"
   # JWT_SECRET="your_secure_secret"
   ```

2. Start all services using `--env-file server/.env`:
   ```bash
   docker compose --env-file server/.env up -d
   ```

3. Verify running containers:
   ```bash
   docker compose ps
   ```

4. View logs:
   ```bash
   docker compose logs -f api
   docker compose logs -f reminder-worker
   docker compose logs -f ingestion-worker
   docker compose logs -f frontend
   ```

5. Stop all services cleanly:
   ```bash
   docker compose down
   ```

---

## 5. Security & Best Practices

1. **Non-Root Execution:** Backend containers run under the unprivileged `node` user (`UID 1000`).
2. **No Committed Secrets:** Both `/.dockerignore` and `server/.dockerignore` strictly prevent `.env`, `.env.*`, `.git`, test databases, logs, and temporary files from being baked into images.
3. **Multi-Stage Pruning:** Development dependencies (`vitest`, `nodemon`, `@tailwindcss/vite`, `supertest`) and source code are stripped from final production images.
4. **Network Isolation & Rate Limit Protection:** The backend API container exposes port `5000` solely to the internal Docker network and is not directly published on the host. All inbound HTTP traffic must traverse the frontend Nginx reverse proxy. Because Nginx sets `X-Forwarded-For` from the incoming TCP connection, clients cannot forge headers to manipulate `TRUST_PROXY=1` and bypass IP-based rate limiting.
