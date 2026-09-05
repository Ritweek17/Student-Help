import * as savedOpportunityService from '../services/savedOpportunity.service.js';
import { validateOpportunityId, validateSavedQuery } from '../validators/savedOpportunity.validator.js';

export async function saveOpportunity(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateOpportunityId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const userId = request.auth.userId;
    const result = await savedOpportunityService.saveOpportunity(userId, id);

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

export async function unsaveOpportunity(request, response, next) {
  try {
    const { id } = request.params;
    if (!validateOpportunityId(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const userId = request.auth.userId;
    const result = await savedOpportunityService.unsaveOpportunity(userId, id);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function listSavedOpportunities(request, response, next) {
  try {
    const { error, value } = validateSavedQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await savedOpportunityService.listSavedOpportunities(userId, value);

    return response.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}
