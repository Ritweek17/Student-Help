import { Router } from 'express';
import {
  createTrackerActivity,
  getTrackerActivity,
  listTrackerActivities,
  updateTrackerActivity,
  deleteTrackerActivity,
} from '../controllers/tracker.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const trackerRouter = Router();

trackerRouter.use(requireAuth);

trackerRouter.post('/tracker', createTrackerActivity);
trackerRouter.get('/tracker', listTrackerActivities);
trackerRouter.get('/tracker/:id', getTrackerActivity);
trackerRouter.put('/tracker/:id', updateTrackerActivity);
trackerRouter.delete('/tracker/:id', deleteTrackerActivity);
