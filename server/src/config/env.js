import dotenv from 'dotenv';

dotenv.config();

const requiredVariables = ['PORT', 'NODE_ENV', 'CLIENT_URL', 'MONGODB_URI'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missingVariables.join(', ')}`);
}

const port = Number(process.env.PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid port number');
}

if (!['development', 'test', 'production'].includes(process.env.NODE_ENV)) {
  throw new Error('NODE_ENV must be development, test, or production');
}

try {
  new URL(process.env.CLIENT_URL);
} catch {
  throw new Error('CLIENT_URL must be a valid URL');
}

try {
  const mongodbUrl = new URL(process.env.MONGODB_URI);

  if (!['mongodb:', 'mongodb+srv:'].includes(mongodbUrl.protocol)) {
    throw new Error('Invalid MongoDB protocol');
  }
} catch {
  throw new Error('MONGODB_URI must be a valid MongoDB connection URI');
}

export const env = Object.freeze({
  port,
  nodeEnv: process.env.NODE_ENV,
  clientUrl: process.env.CLIENT_URL,
  mongodbUri: process.env.MONGODB_URI,
});
