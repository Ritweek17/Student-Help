import { Router } from 'express';
import {
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from '../controllers/opportunity.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';

export const opportunityRouter = Router();

opportunityRouter.use(requireAuth);

opportunityRouter.get('/', listOpportunities);
opportunityRouter.get('/:id', getOpportunityById);

opportunityRouter.post('/', requireRole('admin'), createOpportunity);
opportunityRouter.put('/:id', requireRole('admin'), updateOpportunity);
opportunityRouter.delete('/:id', requireRole('admin'), deleteOpportunity);
