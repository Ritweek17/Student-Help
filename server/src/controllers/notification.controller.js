import * as notificationService from '../services/notification.service.js';
import {
  validateNotificationId,
  validateNotificationCreate,
  validateNotificationQuery,
} from '../validators/notification.validator.js';

export async function createNotification(request, response, next) {
  try {
    const { error, value } = validateNotificationCreate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await notificationService.createNotification(userId, value);

    if (result.status === 400) {
      return response.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function getNotification(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateNotificationId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const userId = request.auth.userId;
    const result = await notificationService.getNotification(userId, id);

    if (result.status === 404) {
      return response.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function listNotifications(request, response, next) {
  try {
    const { error, value } = validateNotificationQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await notificationService.listNotifications(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function markNotificationRead(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateNotificationId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const userId = request.auth.userId;
    const result = await notificationService.markNotificationRead(userId, id);

    if (result.status === 404) {
      return response.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function markAllNotificationsRead(request, response, next) {
  try {
    const userId = request.auth.userId;
    const result = await notificationService.markAllNotificationsRead(userId);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function dismissNotification(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateNotificationId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const userId = request.auth.userId;
    const result = await notificationService.dismissNotification(userId, id);

    if (result.status === 404) {
      return response.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function deleteNotification(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateNotificationId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const userId = request.auth.userId;
    const result = await notificationService.deleteNotification(userId, id);

    if (result.status === 404) {
      return response.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function getUnreadCount(request, response, next) {
  try {
    const userId = request.auth.userId;
    const result = await notificationService.getUnreadCount(userId);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}
