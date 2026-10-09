import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Atlas SRV lookups on local environments with restrictive DNS resolvers can override DNS servers.
// For containerized environments and standard non-SRV URIs, preserve standard system/container DNS resolution.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
} else if (env.mongodbUri?.startsWith('mongodb+srv:')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

let connectionFailed = false;

function isPermanentConfigError(error) {
  if (!error) return false;
  if (error.name === 'MongoParseError') return true;
  if (error.name === 'MongoRuntimeError' && error.message?.toLowerCase().includes('unable to parse')) return true;
  if (error.name === 'TypeError' && error.message?.includes('Invalid URL')) return true;
  if (error.message?.toLowerCase().includes('invalid scheme') || error.message?.toLowerCase().includes('invalid connection string')) return true;
  return false;
}

export async function connectDatabase(options = {}) {
  const maxRetries = options.maxRetries ?? (Number(process.env.DB_MAX_RETRIES) || 5);
  const initialDelayMs = options.initialDelayMs ?? (Number(process.env.DB_INITIAL_DELAY_MS) || 1000);
  const maxDelayMs = options.maxDelayMs ?? (Number(process.env.DB_MAX_DELAY_MS) || 10000);
  const backoffFactor = options.backoffFactor ?? 2;
  const uri = options.uri || env.mongodbUri;

  if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
    if (!options.uri) {
      connectionFailed = false;
      return mongoose.connection;
    }
    await mongoose.disconnect();
  }

  connectionFailed = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri);
      connectionFailed = false;
      console.log('MongoDB connected successfully');
      return mongoose.connection;
    } catch (error) {
      if (isPermanentConfigError(error)) {
        connectionFailed = true;
        console.error('MongoDB configuration error. Aborting connection attempts.', {
          name: error.name,
          code: error.code,
        });
        throw error;
      }

      if (attempt < maxRetries) {
        const delayMs = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt - 1), maxDelayMs);
        console.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed (${error.name || 'Error'}). Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        connectionFailed = true;
        console.error(`MongoDB connection failed after ${maxRetries} attempts. Check database configuration and network access.`, {
          name: error.name,
          code: error.code,
        });
        throw error;
      }
    }
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export function getDatabaseStatus() {
  if (connectionFailed) {
    return 'failed';
  }

  switch (mongoose.connection.readyState) {
    case mongoose.ConnectionStates.connected:
      return 'connected';
    case mongoose.ConnectionStates.connecting:
      return 'connecting';
    default:
      return 'disconnected';
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
    await mongoose.disconnect();
  }
}
