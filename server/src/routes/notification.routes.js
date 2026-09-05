import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as notificationController from '../controllers/notification.controller.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.post('/notifications', notificationController.createNotification);
notificationRouter.get('/notifications', notificationController.listNotifications);
notificationRouter.get('/notifications/unread-count', notificationController.getUnreadCount);
notificationRouter.put('/notifications/read-all', notificationController.markAllNotificationsRead);
notificationRouter.get('/notifications/:id', notificationController.getNotification);
notificationRouter.put('/notifications/:id/read', notificationController.markNotificationRead);
notificationRouter.put('/notifications/:id/dismiss', notificationController.dismissNotification);
notificationRouter.delete('/notifications/:id', notificationController.deleteNotification);
