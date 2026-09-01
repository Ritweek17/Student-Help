import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { profileRouter } from './routes/profile.routes.js';

export const app = express();

app.use(cors({
  origin: env.clientUrl,
}));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);

app.use(notFoundHandler);
app.use(errorHandler);

