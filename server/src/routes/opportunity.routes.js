import { Router } from 'express';
import { listOpportunities, getOpportunityById } from '../controllers/opportunity.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const opportunityRouter = Router();

opportunityRouter.use(requireAuth);

opportunityRouter.get('/', listOpportunities);
opportunityRouter.get('/:id', getOpportunityById);
