import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { getCurrentUser, login, logout, refresh, signup } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const authRateLimit = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

export const authRouter = Router();

authRouter.use(authRateLimit);
authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, getCurrentUser);
