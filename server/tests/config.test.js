import { describe, it, expect } from 'vitest';
import express from 'express';
import {
  sanitizeClientUrl,
  parseTrustProxy,
  validateEnvironment,
  validateIntegrationCredentials,
  env,
} from '../src/config/env.js';

describe('Phase 10E — Environment & Production Configuration Test Suite', () => {
  const validBaseEnv = {
    PORT: '5000',
    NODE_ENV: 'test',
    CLIENT_URL: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/careeros_test',
    JWT_SECRET: 'supersecretjwtkeyforcareeros12345',
    JWT_EXPIRES_IN: '15m',
  };

  describe('1. CLIENT_URL Normalization & Sanitization', () => {
    it('normalizes single trailing slash to origin without trailing slash', () => {
      expect(sanitizeClientUrl('http://localhost:5173/')).toBe('http://localhost:5173');
      expect(sanitizeClientUrl('https://careeros.app/')).toBe('https://careeros.app');
    });

    it('normalizes multiple trailing slashes', () => {
      expect(sanitizeClientUrl('http://localhost:5173///')).toBe('http://localhost:5173');
      expect(sanitizeClientUrl('https://api.careeros.app//')).toBe('https://api.careeros.app');
    });

    it('preserves clean URL origin untouched', () => {
      expect(sanitizeClientUrl('http://localhost:5173')).toBe('http://localhost:5173');
      expect(sanitizeClientUrl('https://app.careeros.io:8080')).toBe('https://app.careeros.io:8080');
    });

    it('rejects invalid or missing URL values', () => {
      expect(() => sanitizeClientUrl('')).toThrow(/CLIENT_URL must be a valid URL/);
      expect(() => sanitizeClientUrl(null)).toThrow(/CLIENT_URL must be a valid URL/);
      expect(() => sanitizeClientUrl(undefined)).toThrow(/CLIENT_URL must be a valid URL/);
      expect(() => sanitizeClientUrl('not-a-valid-url')).toThrow(/CLIENT_URL must be a valid URL/);
      expect(() => sanitizeClientUrl('ftp://careeros.app')).toThrow(/CLIENT_URL must be a valid URL/);
    });
  });

  describe('2. TRUST_PROXY Parsing & Configuration', () => {
    it('defaults to false when undefined, null, empty, false, or 0', () => {
      expect(parseTrustProxy(undefined)).toBe(false);
      expect(parseTrustProxy(null)).toBe(false);
      expect(parseTrustProxy('')).toBe(false);
      expect(parseTrustProxy('false')).toBe(false);
      expect(parseTrustProxy('0')).toBe(false);
    });

    it('safely maps true to 1 hop to prevent blind proxy trust', () => {
      expect(parseTrustProxy('true')).toBe(1);
    });

    it('parses positive integers as number of hops', () => {
      expect(parseTrustProxy('1')).toBe(1);
      expect(parseTrustProxy('2')).toBe(2);
      expect(parseTrustProxy(3)).toBe(3);
    });

    it('preserves string identifiers and subnets', () => {
      expect(parseTrustProxy('loopback')).toBe('loopback');
      expect(parseTrustProxy('10.0.0.0/8, 172.16.0.0/12')).toBe('10.0.0.0/8, 172.16.0.0/12');
    });

    it('configures Express trust proxy setting correctly', () => {
      const app = express();
      const trustedHops = parseTrustProxy('1');
      if (trustedHops !== false) {
        app.set('trust proxy', trustedHops);
      }
      expect(app.get('trust proxy')).toBe(1);
    });
  });

  describe('3. Production-Grade Environment Validation', () => {
    it('successfully validates a valid production environment', () => {
      const prodEnv = {
        ...validBaseEnv,
        NODE_ENV: 'production',
        CLIENT_URL: 'https://careeros.app/',
        JWT_SECRET: 'production_secret_key_at_least_32_characters_long',
        TRUST_PROXY: '1',
      };

      const parsed = validateEnvironment(prodEnv);
      expect(parsed.nodeEnv).toBe('production');
      expect(parsed.clientUrl).toBe('https://careeros.app');
      expect(parsed.trustProxy).toBe(1);
      expect(parsed.port).toBe(5000);
      expect(parsed.mongodbUri).toBe(validBaseEnv.MONGODB_URI);
    });

    it('rejects short JWT_SECRET in production mode (< 16 chars)', () => {
      const weakProdEnv = {
        ...validBaseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'short_secret',
      };

      expect(() => validateEnvironment(weakProdEnv)).toThrow(
        /JWT_SECRET must be at least 16 characters in production/
      );
    });

    it('allows shorter JWT_SECRET in development mode', () => {
      const devEnv = {
        ...validBaseEnv,
        NODE_ENV: 'development',
        JWT_SECRET: 'devsecret',
      };

      const parsed = validateEnvironment(devEnv);
      expect(parsed.jwtSecret).toBe('devsecret');
    });

    it('rejects missing required environment variables', () => {
      const missingPortEnv = { ...validBaseEnv };
      delete missingPortEnv.PORT;

      expect(() => validateEnvironment(missingPortEnv)).toThrow(
        /Missing required environment variable\(s\): PORT/
      );
    });

    it('rejects invalid PORT numbers', () => {
      expect(() => validateEnvironment({ ...validBaseEnv, PORT: '0' })).toThrow(/PORT must be a valid port number/);
      expect(() => validateEnvironment({ ...validBaseEnv, PORT: '70000' })).toThrow(/PORT must be a valid port number/);
      expect(() => validateEnvironment({ ...validBaseEnv, PORT: 'invalid' })).toThrow(/PORT must be a valid port number/);
    });

    it('rejects invalid NODE_ENV values', () => {
      expect(() => validateEnvironment({ ...validBaseEnv, NODE_ENV: 'staging' })).toThrow(
        /NODE_ENV must be development, test, or production/
      );
    });

    it('rejects invalid MongoDB URI protocol', () => {
      expect(() => validateEnvironment({ ...validBaseEnv, MONGODB_URI: 'http://localhost:27017' })).toThrow(
        /Invalid MongoDB protocol/
      );
      expect(() => validateEnvironment({ ...validBaseEnv, MONGODB_URI: 'not-a-uri' })).toThrow(
        /MONGODB_URI must be a valid MongoDB connection URI/
      );
    });
  });

  describe('4. Optional Source Adapter Credential Isolation', () => {
    it('boots cleanly when Adzuna credentials are completely unconfigured', () => {
      const unconfiguredEnv = {
        ...validBaseEnv,
        ADZUNA_APP_ID: '',
        ADZUNA_APP_KEY: '',
      };

      const parsed = validateEnvironment(unconfiguredEnv);
      expect(parsed.adzuna.isConfigured).toBe(false);
      expect(parsed.adzuna.appId).toBeNull();
      expect(parsed.adzuna.appKey).toBeNull();
    });

    it('fails fast when Adzuna credentials are only partially configured', () => {
      const onlyIdEnv = {
        ...validBaseEnv,
        ADZUNA_APP_ID: 'adzuna_id_123',
        ADZUNA_APP_KEY: '',
      };

      expect(() => validateEnvironment(onlyIdEnv)).toThrow(
        /Malformed Adzuna configuration: both ADZUNA_APP_ID and ADZUNA_APP_KEY must be provided if either is set/
      );

      const onlyKeyEnv = {
        ...validBaseEnv,
        ADZUNA_APP_ID: '',
        ADZUNA_APP_KEY: 'adzuna_key_456',
      };

      expect(() => validateEnvironment(onlyKeyEnv)).toThrow(
        /Malformed Adzuna configuration: both ADZUNA_APP_ID and ADZUNA_APP_KEY must be provided if either is set/
      );
    });

    it('accepts complete Adzuna credentials when both are provided', () => {
      const configuredEnv = {
        ...validBaseEnv,
        ADZUNA_APP_ID: 'valid_id',
        ADZUNA_APP_KEY: 'valid_key',
      };

      const parsed = validateEnvironment(configuredEnv);
      expect(parsed.adzuna.isConfigured).toBe(true);
      expect(parsed.adzuna.appId).toBe('valid_id');
      expect(parsed.adzuna.appKey).toBe('valid_key');
    });
  });

  describe('5. Active Application Env Instance Integrity', () => {
    it('exports a frozen active env instance with valid properties', () => {
      expect(Object.isFrozen(env)).toBe(true);
      expect(typeof env.port).toBe('number');
      expect(env.port).toBeGreaterThan(0);
      expect(['development', 'test', 'production']).toContain(env.nodeEnv);
      expect(typeof env.clientUrl).toBe('string');
      expect(env.clientUrl).not.toMatch(/\/$/);
      expect(env.jwtSecret).toBeDefined();
      expect(env.rateLimit).toBeDefined();
      expect(env.auth).toBeDefined();
    });
  });
});
