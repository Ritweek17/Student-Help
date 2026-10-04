import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import * as adminIngestionController from '../controllers/admin.ingestion.controller.js';

export const adminIngestionRouter = Router();

// All ingestion admin routes require authentication and admin role
adminIngestionRouter.use(requireAuth, requireRole('admin'));

// Source Management
adminIngestionRouter.get('/sources', adminIngestionController.listSources);
adminIngestionRouter.patch('/sources/:id', adminIngestionController.updateSource);

// Ingestion Runs
adminIngestionRouter.get('/ingestion-runs', adminIngestionController.listIngestionRuns);
adminIngestionRouter.get('/ingestion-runs/:id', adminIngestionController.getIngestionRunById);

// Bulk Curation
adminIngestionRouter.post('/opportunities/bulk', adminIngestionController.bulkCurateOpportunities);
