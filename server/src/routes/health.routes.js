import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/health.controller.js';

export const healthRouter = Router();

// Legacy and backward compatible endpoints
healthRouter.get('/health', getHealth);

// Standard Kubernetes / Docker health probes
healthRouter.get('/health/live', getLiveness);
healthRouter.get('/health/ready', getReadiness);

// Also support sub-paths when mounted directly on /health prefix
healthRouter.get('/live', getLiveness);
healthRouter.get('/ready', getReadiness);

