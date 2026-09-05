import { Router } from 'express';
import {
  createApplication,
  getApplication,
  listApplications,
  updateApplication,
  deleteApplication,
} from '../controllers/application.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const applicationRouter = Router();

applicationRouter.use(requireAuth);

applicationRouter.post('/applications', createApplication);
applicationRouter.get('/applications', listApplications);
applicationRouter.get('/applications/:opportunityId', getApplication);
applicationRouter.put('/applications/:opportunityId', updateApplication);
applicationRouter.delete('/applications/:opportunityId', deleteApplication);
