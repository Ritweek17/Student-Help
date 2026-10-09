import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// 1. Attempt default cwd .env first
dotenv.config();

// 2. If running from repository root, also attempt loading server/.env
try {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(currentDir, '../../.env') });
} catch {
  // Ignore in environments where fileURLToPath or fs access differs
}

/**
 * Strips trailing slash(es) from a valid HTTP/HTTPS URL origin.
 * Throws if the URL is missing or has an invalid scheme.
 */
export function sanitizeClientUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('CLIENT_URL must be a valid URL with http or https protocol');
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('CLIENT_URL must be a valid URL with http or https protocol');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('CLIENT_URL must be a valid URL with http or https protocol');
  }

  return trimmed.replace(/\/+$/, '');
}

/**
 * Parses TRUST_PROXY configuration:
 * - undefined / null / empty / 'false' / '0' -> false
 * - 'true' -> 1 (safe single-hop behind reverse proxy; prevents spoofing)
 * - positive integer -> number of trusted hops (e.g. 1, 2)
 * - string -> IP, CIDR subnet, or express keyword ('loopback', 'linklocal', etc.)
 */
export function parseTrustProxy(val) {
  if (val === undefined || val === null || val === '') {
    return false;
  }

  const trimmed = String(val).trim();
  if (trimmed === 'false' || trimmed === '0') {
    return false;
  }

  if (trimmed === 'true') {
    return 1;
  }

  const num = Number(trimmed);
  if (Number.isInteger(num) && num > 0) {
    return num;
  }

  return trimmed;
}

/**
 * Validates environment dictionary (defaulting to process.env).
 * Throws immediately if critical required variables are missing or invalid.
 */
export function validateEnvironment(envSource = process.env) {
  const requiredVariables = ['PORT', 'NODE_ENV', 'CLIENT_URL', 'MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN'];
  const missingVariables = requiredVariables.filter((name) => !envSource[name] || String(envSource[name]).trim() === '');

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missingVariables.join(', ')}`);
  }

  const port = Number(envSource.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number');
  }

  if (!['development', 'test', 'production'].includes(envSource.NODE_ENV)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const clientUrl = sanitizeClientUrl(envSource.CLIENT_URL);

  let mongodbUrl;
  try {
    mongodbUrl = new URL(envSource.MONGODB_URI);
  } catch {
    throw new Error('MONGODB_URI must be a valid MongoDB connection URI');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(mongodbUrl.protocol)) {
    throw new Error('Invalid MongoDB protocol');
  }

  if (envSource.NODE_ENV === 'production' && String(envSource.JWT_SECRET).length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters in production');
  }

  // Optional integration credentials validation (Adzuna):
  // Application boots cleanly if credentials are not configured,
  // but fails clearly if partially or malformed configured.
  const adzunaAppId = envSource.ADZUNA_APP_ID?.trim() || null;
  const adzunaAppKey = envSource.ADZUNA_APP_KEY?.trim() || null;

  if ((adzunaAppId && !adzunaAppKey) || (!adzunaAppId && adzunaAppKey)) {
    throw new Error('Malformed Adzuna configuration: both ADZUNA_APP_ID and ADZUNA_APP_KEY must be provided if either is set');
  }

  // AI Orchestration Configuration Validation (Phase 11H — B4)
  const aiProvider = envSource.AI_PROVIDER?.trim() || 'mock';
  const aiApiKey = envSource.AI_API_KEY?.trim() || null;
  const aiModel = envSource.AI_MODEL?.trim() || null;
  const aiTimeoutMs = envSource.AI_TIMEOUT_MS !== undefined && envSource.AI_TIMEOUT_MS !== ''
    ? Number(envSource.AI_TIMEOUT_MS)
    : 6000;

  if (isNaN(aiTimeoutMs) || aiTimeoutMs <= 0) {
    throw new Error('AI_TIMEOUT_MS must be a positive number');
  }

  const supportedAIProviders = ['mock', 'gemini', 'openai'];
  if (!supportedAIProviders.includes(aiProvider)) {
    throw new Error(`Unsupported AI provider: ${aiProvider}. Supported providers: ${supportedAIProviders.join(', ')}`);
  }

  if (aiProvider !== 'mock' && !aiApiKey) {
    throw new Error(`Missing provider credentials: AI_API_KEY is required when AI_PROVIDER is '${aiProvider}'`);
  }

  const trustProxy = parseTrustProxy(envSource.TRUST_PROXY);

  return {
    port,
    nodeEnv: envSource.NODE_ENV,
    clientUrl,
    trustProxy,
    mongodbUri: envSource.MONGODB_URI,
    jwtSecret: envSource.JWT_SECRET,
    jwtExpiresIn: envSource.JWT_EXPIRES_IN,
    rateLimit: Object.freeze({
      max: Number(envSource.RATE_LIMIT_MAX) || 1000,
      windowMs: Number(envSource.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      authMax: Number(envSource.AUTH_RATE_LIMIT_MAX) || 100,
      authWindowMs: Number(envSource.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    }),
    adzuna: Object.freeze({
      appId: adzunaAppId,
      appKey: adzunaAppKey,
      isConfigured: Boolean(adzunaAppId && adzunaAppKey),
    }),
    ai: Object.freeze({
      provider: aiProvider,
      apiKey: aiApiKey,
      model: aiModel,
      timeoutMs: aiTimeoutMs,
      isConfigured: aiProvider === 'mock' || Boolean(aiApiKey),
    }),
    auth: Object.freeze({
      accessTokenExpiresIn: envSource.ACCESS_TOKEN_EXPIRES_IN || envSource.JWT_EXPIRES_IN || '15m',
      refreshTokenExpiresInDays: Number(envSource.REFRESH_TOKEN_EXPIRES_IN_DAYS) || 7,
      refreshCookieName: envSource.REFRESH_COOKIE_NAME || 'careeros_refresh_token',
    }),
  };
}

export function validateIntegrationCredentials(slug) {
  if (slug === 'adzuna') {
    const id = process.env.ADZUNA_APP_ID?.trim();
    const key = process.env.ADZUNA_APP_KEY?.trim();
    if (!id || !key) {
      throw new Error('Adzuna credentials missing (ADZUNA_APP_ID, ADZUNA_APP_KEY)');
    }
    return { appId: id, appKey: key };
  }
  return {};
}

/**
 * Validates AI provider configuration on startup or on demand.
 */
export function validateAIConfiguration(envSource = process.env) {
  const provider = envSource.AI_PROVIDER?.trim() || 'mock';
  const apiKey = envSource.AI_API_KEY?.trim() || null;
  const timeoutMs = envSource.AI_TIMEOUT_MS !== undefined && envSource.AI_TIMEOUT_MS !== ''
    ? Number(envSource.AI_TIMEOUT_MS)
    : 6000;

  if (isNaN(timeoutMs) || timeoutMs <= 0) {
    throw new Error('AI_TIMEOUT_MS must be a positive number');
  }

  const supportedProviders = ['mock', 'gemini', 'openai'];
  if (!supportedProviders.includes(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}`);
  }

  if (provider !== 'mock' && !apiKey) {
    throw new Error(`Missing provider credentials: AI_API_KEY is required when AI_PROVIDER is '${provider}'`);
  }

  return { provider, apiKey, timeoutMs };
}

export const env = Object.freeze(validateEnvironment(process.env));
