import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from '../setup.js';

describe('CareerOS Health & Readiness Probes Test Suite', () => {
  let replSetUri;

  beforeAll(async () => {
    const res = await setupTestDatabase();
    replSetUri = res.uri;
  });

  afterAll(async () => {
    // Ensure connected before teardown if disconnected during test
    if (mongoose.connection.readyState === mongoose.ConnectionStates.disconnected) {
      await mongoose.connect(replSetUri);
    }
    await teardownTestDatabase();
  });

  describe('1. Liveness Probe (GET /health/live)', () => {
    it('returns HTTP 200 and alive status when database is connected', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('alive');
      expect(res.body.message).toBe('CareerOS API process is alive');
    });

    it('returns HTTP 200 even when database is disconnected (liveness independent of DB)', async () => {
      // Disconnect mongoose temporarily
      await mongoose.disconnect();

      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('alive');

      // Reconnect mongoose for subsequent tests
      await mongoose.connect(replSetUri);
    });

    it('does not require authentication', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
    });

    it('does not expose internal secrets or connection strings', async () => {
      const res = await request(app).get('/health/live');
      const text = JSON.stringify(res.body);

      expect(text).not.toContain('secret');
      expect(text).not.toContain('password');
      expect(text).not.toContain('mongodb');
    });
  });

  describe('2. Readiness Probe (GET /health/ready)', () => {
    it('returns HTTP 200 and ready status when database is connected', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });

    it('returns HTTP 503 and not_ready status when database is disconnected', async () => {
      // Disconnect mongoose to simulate outage
      await mongoose.disconnect();

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.database).toBe('disconnected');

      // Reconnect mongoose
      await mongoose.connect(replSetUri);
      expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.connected);
    });

    it('does not require authentication', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
    });

    it('does not leak internal database credentials or URI strings', async () => {
      const res = await request(app).get('/health/ready');
      const text = JSON.stringify(res.body);

      expect(text).not.toContain('password');
      expect(text).not.toContain('mongodb');
      expect(text).not.toContain('127.0.0.1');
      expect(text).not.toContain('replicaSet');
    });
  });

  describe('3. Legacy Health Endpoint Backward Compatibility (GET /api/health)', () => {
    it('returns HTTP 200 with database: connected when healthy', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('CareerOS API is running');
      expect(res.body.database).toBe('connected');
    });

    it('returns HTTP 503 with database: disconnected when database is down', async () => {
      await mongoose.disconnect();

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('CareerOS API database is unavailable');
      expect(res.body.database).toBe('disconnected');

      await mongoose.connect(replSetUri);
    });

    it('also responds at GET /health for direct health check', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.database).toBe('connected');
    });
  });
});
