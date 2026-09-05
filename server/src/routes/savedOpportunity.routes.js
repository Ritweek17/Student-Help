import { Router } from 'express';
import {
  saveOpportunity,
  unsaveOpportunity,
  listSavedOpportunities,
} from '../controllers/savedOpportunity.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const savedOpportunityRouter = Router();

savedOpportunityRouter.use(requireAuth);

savedOpportunityRouter.post('/opportunities/:id/save', saveOpportunity);
savedOpportunityRouter.delete('/opportunities/:id/save', unsaveOpportunity);
savedOpportunityRouter.get('/saved-opportunities', listSavedOpportunities);
