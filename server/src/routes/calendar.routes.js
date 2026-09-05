import { Router } from 'express';
import {
  createCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../controllers/calendar.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.post('/calendar', createCalendarEvent);
calendarRouter.get('/calendar', listCalendarEvents);
calendarRouter.get('/calendar/:id', getCalendarEvent);
calendarRouter.put('/calendar/:id', updateCalendarEvent);
calendarRouter.delete('/calendar/:id', deleteCalendarEvent);
