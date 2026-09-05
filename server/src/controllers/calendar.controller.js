import * as calendarService from '../services/calendar.service.js';
import {
  validateEventId,
  validateCalendarCreate,
  validateCalendarUpdate,
  validateCalendarQuery,
} from '../validators/calendar.validator.js';

export async function createCalendarEvent(request, response, next) {
  try {
    const { error, value } = validateCalendarCreate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await calendarService.createCalendarEvent(userId, value);

    return response.status(result.status).json(result.data || { success: false, message: result.message });
  } catch (error) {
    return next(error);
  }
}

export async function getCalendarEvent(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateEventId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const userId = request.auth.userId;
    const result = await calendarService.getCalendarEvent(userId, id);

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

export async function listCalendarEvents(request, response, next) {
  try {
    const { error, value } = validateCalendarQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await calendarService.listCalendarEvents(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function updateCalendarEvent(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateEventId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const { error, value } = validateCalendarUpdate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await calendarService.updateCalendarEvent(userId, id, value);

    if (result.status === 404 || result.status === 400) {
      return response.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function deleteCalendarEvent(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateEventId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid event ID',
      });
    }

    const userId = request.auth.userId;
    const result = await calendarService.deleteCalendarEvent(userId, id);

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
