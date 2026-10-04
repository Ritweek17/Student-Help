import * as goalService from '../services/goal.service.js';
import {
  validateGoalId,
  validateGoalCreate,
  validateGoalUpdate,
  validateGoalQuery,
} from '../validators/goal.validator.js';

export async function createGoal(request, response, next) {
  try {
    const { error, value } = validateGoalCreate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await goalService.createGoal(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function getGoal(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateGoalId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid goal ID',
      });
    }

    const userId = request.auth.userId;
    const result = await goalService.getGoal(userId, id);

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

export async function listGoals(request, response, next) {
  try {
    const { error, value } = validateGoalQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await goalService.listGoals(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function updateGoal(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateGoalId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid goal ID',
      });
    }

    const { error, value } = validateGoalUpdate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await goalService.updateGoal(userId, id, value);

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

export async function deleteGoal(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateGoalId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid goal ID',
      });
    }

    const userId = request.auth.userId;
    const result = await goalService.deleteGoal(userId, id);

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
