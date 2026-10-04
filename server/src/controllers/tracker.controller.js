import * as trackerService from '../services/tracker.service.js';
import {
  validateTrackerId,
  validateTrackerCreate,
  validateTrackerUpdate,
  validateTrackerQuery,
} from '../validators/tracker.validator.js';

export async function createTrackerActivity(request, response, next) {
  try {
    const { error, value } = validateTrackerCreate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await trackerService.createActivity(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function getTrackerActivity(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateTrackerId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid activity ID',
      });
    }

    const userId = request.auth.userId;
    const result = await trackerService.getActivity(userId, id);

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

export async function listTrackerActivities(request, response, next) {
  try {
    const { error, value } = validateTrackerQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await trackerService.listActivities(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function updateTrackerActivity(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateTrackerId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid activity ID',
      });
    }

    const { error, value } = validateTrackerUpdate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await trackerService.updateActivity(userId, id, value);

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

export async function deleteTrackerActivity(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateTrackerId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid activity ID',
      });
    }

    const userId = request.auth.userId;
    const result = await trackerService.deleteActivity(userId, id);

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
