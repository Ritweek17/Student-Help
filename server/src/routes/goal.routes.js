import { Router } from 'express';
import {
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
  deleteGoal,
} from '../controllers/goal.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const goalRouter = Router();

goalRouter.use(requireAuth);

goalRouter.post('/goals', createGoal);
goalRouter.get('/goals', listGoals);
goalRouter.get('/goals/:id', getGoal);
goalRouter.put('/goals/:id', updateGoal);
goalRouter.delete('/goals/:id', deleteGoal);
