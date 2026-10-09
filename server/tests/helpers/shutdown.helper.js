import { EventEmitter } from 'events';

/**
 * Creates a mock HTTP server to verify graceful shutdown ordering and request draining.
 */
export function createMockHttpServer(options = {}) {
  const { closeDelayMs = 10, shouldFailClose = false } = options;
  const events = [];

  const mockServer = {
    closed: false,
    closeIdleConnectionsCalled: false,
    events,
    closeIdleConnections() {
      mockServer.closeIdleConnectionsCalled = true;
      events.push('closeIdleConnections');
    },
    close(cb) {
      mockServer.closed = true;
      events.push('serverCloseInitiated');
      setTimeout(() => {
        events.push('serverCloseCompleted');
        if (shouldFailClose) {
          cb(new Error('Mock server close failure'));
        } else {
          cb();
        }
      }, closeDelayMs);
    },
  };

  return mockServer;
}

/**
 * Creates a mock process.exit function that records the exit code without terminating Vitest.
 */
export function createMockExit() {
  let exitCode = null;
  let exitCalled = false;

  const fn = (code) => {
    exitCalled = true;
    exitCode = code;
  };

  return {
    fn,
    hasExited: () => exitCalled,
    getCode: () => exitCode,
  };
}

/**
 * Creates a mock logger that suppresses output and records calls.
 */
export function createMockLogger() {
  const logs = [];
  const errors = [];
  const warns = [];

  return {
    log: (...args) => logs.push(args.join(' ')),
    error: (...args) => errors.push(args.join(' ')),
    warn: (...args) => warns.push(args.join(' ')),
    logs,
    errors,
    warns,
  };
}
