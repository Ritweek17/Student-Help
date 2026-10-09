import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as learningController from '../controllers/learning.controller.js';

export const learningRouter = Router();

learningRouter.use(requireAuth); // All routes require auth

// Content (Read-Only)
learningRouter.get('/tracks', learningController.getTracks);
learningRouter.get('/tracks/:id', learningController.getTrack);
learningRouter.get('/tracks/:id/items', learningController.getTrackItems);
learningRouter.get('/resources', learningController.getResources);
learningRouter.get('/recommended', learningController.getRecommendedNext);

// Progress (User-Owned Write/Read)
learningRouter.patch('/progress', learningController.updateProgress);
