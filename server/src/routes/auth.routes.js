import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getCurrentUser, login, signup } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

export const authRouter = Router();

authRouter.use(authRateLimit);
authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.get('/me', requireAuth, getCurrentUser);
