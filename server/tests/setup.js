import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { RefreshToken } from '../src/models/RefreshToken.js';

let replSet = null;

export async function setupTestDatabase() {
  // Start isolated in-memory single-node replica set for Mongoose transaction support
  replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: 'ephemeralForTest',
    },
  });

  const uri = replSet.getUri();

  // Connect Mongoose to the in-memory replica set
  await connectDatabase({
    uri,
    maxRetries: 3,
    initialDelayMs: 100,
  });

  // Strict safety assertion: verify that test database is NOT the local daemon on 27017
  if (mongoose.connection.port === 27017) {
    throw new Error('Safety assertion failed: Test runner is connected to local MongoDB port 27017 instead of in-memory replica set!');
  }

  // Initialize schema indexes
  await Promise.all([
    User.init(),
    Profile.init(),
    RefreshToken.init(),
  ]);

  return { replSet, uri };
}

export async function clearTestDatabase() {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
}

export async function teardownTestDatabase() {
  await disconnectDatabase();
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}
