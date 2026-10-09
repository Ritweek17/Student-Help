import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { opportunityRouter } from './routes/opportunity.routes.js';
import { profileRouter } from './routes/profile.routes.js';
import { savedOpportunityRouter } from './routes/savedOpportunity.routes.js';
import { applicationRouter } from './routes/application.routes.js';
import { calendarRouter } from './routes/calendar.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { trackerRouter } from './routes/tracker.routes.js';
import { todoRouter } from './routes/todo.routes.js';
import { goalRouter } from './routes/goal.routes.js';
import { adminIngestionRouter } from './routes/admin.ingestion.routes.js';
import { noteRouter } from './routes/note.routes.js';
import { contestRouter } from './routes/contest.routes.js';
import { learningRouter } from './routes/learning.routes.js';
import { intelligenceRouter } from './routes/intelligence.routes.js';
import { aiRouter } from './routes/ai.routes.js';

export const app = express();

if (env.trustProxy !== false) {
  app.set('trust proxy', env.trustProxy);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: env.clientUrl,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Health probes (liveness, readiness, legacy health)
app.use(healthRouter);
app.use('/health', healthRouter);

// General API rate limiter (skips /api/health)
app.use('/api', apiLimiter);

app.use('/api', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/opportunities', opportunityRouter);
app.use('/api', savedOpportunityRouter);
app.use('/api', applicationRouter);
app.use('/api', calendarRouter);
app.use('/api', notificationRouter);
app.use('/api', trackerRouter);
app.use('/api', todoRouter);
app.use('/api', goalRouter);
app.use('/api', noteRouter);
app.use('/api/contests', contestRouter);
app.use('/api/learning', learningRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/ai', aiRouter);
app.use('/api/admin', adminIngestionRouter);

app.use(notFoundHandler);
app.use(errorHandler);
