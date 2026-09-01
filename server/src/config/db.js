import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Atlas SRV lookups must bypass the non-responsive local DNS resolver.
dns.setServers(['8.8.8.8', '1.1.1.1']);

let connectionFailed = false;

export async function connectDatabase() {
  connectionFailed = false;

  try {
    await mongoose.connect(env.mongodbUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    connectionFailed = true;
    console.error('MongoDB connection failed. Check database configuration and network access.', {
      name: error.name,
      code: error.code,
    });
    throw error;
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
