import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
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

export const app = express();

app.use(cors({
  origin: env.clientUrl,
}));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/opportunities', opportunityRouter);
app.use('/api', savedOpportunityRouter);
app.use('/api', applicationRouter);
app.use('/api', calendarRouter);
app.use('/api', notificationRouter);
app.use('/api', trackerRouter);
app.use('/api', todoRouter);
app.use('/api', goalRouter);
app.use('/api/admin', adminIngestionRouter);



app.use(notFoundHandler);
app.use(errorHandler);
