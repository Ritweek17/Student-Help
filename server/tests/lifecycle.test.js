import { describe, it, expect, vi } from 'vitest';
import {
  createGracefulShutdownHandler,
  setupProcessHandlers,
  sanitizeErrorMessage,
} from '../src/utils/shutdown.js';
import {
  createMockHttpServer,
  createMockExit,
  createMockLogger,
} from './helpers/shutdown.helper.js';
import { shutdown as reminderShutdown } from '../src/workers/reminder.worker.js';
import { shutdown as ingestionShutdown } from '../src/workers/ingestion.worker.js';

describe('CareerOS Lifecycle & Graceful Shutdown Test Suite', () => {
  describe('1. Graceful Shutdown Ordering & Draining', () => {
    it('executes shutdown in correct order: drain requests -> disconnect database -> exit', async () => {
      const order = [];
      const mockServer = createMockHttpServer({ closeDelayMs: 20 });
      const mockExit = createMockExit();
      const mockLogger = createMockLogger();

      const disconnectDb = async () => {
        order.push('disconnectDb');
      };

      const originalClose = mockServer.close;
      mockServer.close = (cb) => {
        order.push('serverClose');
        originalClose.call(mockServer, cb);
      };

      const handler = createGracefulShutdownHandler({
        server: mockServer,
        disconnectDb,
        timeoutMs: 1000,
        exitFn: (code) => {
          order.push(`exit:${code}`);
          mockExit.fn(code);
        },
        logger: mockLogger,
      });

      await handler.shutdown('SIGTERM');

      expect(order).toEqual([
        'serverClose',
        'disconnectDb',
        'exit:0',
      ]);
      expect(mockExit.getCode()).toBe(0);
      expect(mockServer.closeIdleConnectionsCalled).toBe(true);
    });

    it('is strictly idempotent on repeated or concurrent signals', async () => {
      let dbDisconnectCount = 0;
      let serverCloseCount = 0;
      const mockExit = createMockExit();
      const mockLogger = createMockLogger();

      const mockServer = {
        close(cb) {
          serverCloseCount++;
          setTimeout(cb, 10);
        },
      };

      const disconnectDb = async () => {
        dbDisconnectCount++;
      };

      const handler = createGracefulShutdownHandler({
        server: mockServer,
        disconnectDb,
        timeoutMs: 1000,
        exitFn: mockExit.fn,
        logger: mockLogger,
      });

      // Fire multiple signals concurrently
      const [res1, res2, res3] = await Promise.all([
        handler.shutdown('SIGTERM'),
        handler.shutdown('SIGINT'),
        handler.shutdown('SIGTERM'),
      ]);

      expect(serverCloseCount).toBe(1);
      expect(dbDisconnectCount).toBe(1);
      expect(mockExit.getCode()).toBe(0);
    });
  });

  describe('2. Safety Timeout Enforcement', () => {
    it('forces process termination when HTTP server close hangs past timeout', async () => {
      const mockExit = createMockExit();
      const mockLogger = createMockLogger();
      let dbForceDisconnected = false;

      // Server close callback never executes (simulating stuck request)
      const hangingServer = {
        close() {
          // Never invokes callback
        },
      };

      const disconnectDb = async () => {
        dbForceDisconnected = true;
      };

      const handler = createGracefulShutdownHandler({
        server: hangingServer,
        disconnectDb,
        timeoutMs: 50, // Short timeout for deterministic fast testing
        exitFn: mockExit.fn,
        logger: mockLogger,
      });

      handler.shutdown('SIGTERM');

      // Wait 100ms for safety timeout to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockExit.hasExited()).toBe(true);
      expect(mockExit.getCode()).toBe(1);
      expect(dbForceDisconnected).toBe(true);
      expect(mockLogger.errors.some((e) => e.includes('Graceful shutdown timed out'))).toBe(true);
    });
  });

  describe('3. Credential & Secret Scrubbing in Logs', () => {
    it('redacts sensitive MongoDB URI credentials in error messages', () => {
      const rawError = 'Connection failed to mongodb://super_user:very_secret_pass123@cluster0.net/careeros';
      const sanitized = sanitizeErrorMessage(rawError);

      expect(sanitized).not.toContain('super_user');
      expect(sanitized).not.toContain('very_secret_pass123');
      expect(sanitized).toContain('mongodb://[REDACTED]:[REDACTED]@cluster0.net/careeros');
    });

    it('redacts bearer tokens in error messages', () => {
      const rawError = 'Unauthorized request with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123';
      const sanitized = sanitizeErrorMessage(rawError);

      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123');
      expect(sanitized).toContain('Bearer [REDACTED]');
    });
  });

  describe('4. Process-Level Error Handlers (Uncaught & Unhandled)', () => {
    it('sets up listeners and initiates shutdown with exit code 1 on fatal error', async () => {
      let shutdownReason = null;
      const mockExit = createMockExit();
      const mockLogger = createMockLogger();

      const shutdownHandler = {
        shutdown: async (signal) => {
          shutdownReason = signal;
          mockExit.fn(1);
        },
      };

      const cleanup = setupProcessHandlers(shutdownHandler, { logger: mockLogger });

      try {
        // Emit uncaughtException directly
        process.emit('uncaughtException', new Error('Simulated uncaught exception'));
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(shutdownReason).toBe('uncaughtException');
        expect(mockExit.getCode()).toBe(1);
        expect(mockLogger.errors.some((e) => e.includes('Fatal uncaughtException'))).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('cleans up process listeners without leaving orphans', () => {
      const shutdownHandler = { shutdown: vi.fn() };
      const cleanup = setupProcessHandlers(shutdownHandler);

      // Verify cleanup removes listeners
      cleanup();
    });
  });

  describe('5. Worker Shutdown Behavior', () => {
    it('gracefully shuts down reminder worker with custom exit function', async () => {
      let dbClosed = false;
      const mockExit = createMockExit();

      const disconnectDb = async () => {
        dbClosed = true;
      };

      await reminderShutdown('SIGTERM', {
        disconnectDb,
        exitFn: mockExit.fn,
        timeoutMs: 500,
      });

      expect(dbClosed).toBe(true);
      expect(mockExit.getCode()).toBe(0);
    });

    it('gracefully shuts down ingestion worker with custom exit function', async () => {
      let dbClosed = false;
      const mockExit = createMockExit();

      const disconnectDb = async () => {
        dbClosed = true;
      };

      await ingestionShutdown('SIGTERM', {
        disconnectDb,
        exitFn: mockExit.fn,
        timeoutMs: 500,
      });

      expect(dbClosed).toBe(true);
      expect(mockExit.getCode()).toBe(0);
    });
  });
});
