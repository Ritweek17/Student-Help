import { Router } from 'express';
import { get, list } from '../controllers/contest.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const contestRouter = Router();

contestRouter.use(requireAuth);

contestRouter.get('/', list);
contestRouter.get('/:id', get);
