import * as applicationService from '../services/application.service.js';
import {
  validateOpportunityId,
  validateType,
  validateApplicationCreate,
  validateApplicationUpdate,
  validateApplicationQuery,
} from '../validators/application.validator.js';

export async function createApplication(request, response, next) {
  try {
    const { error, value } = validateApplicationCreate(request.body);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await applicationService.createApplication(userId, value.opportunityId, value);

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

export async function getApplication(request, response, next) {
  try {
    const { opportunityId } = request.params;
    if (!validateOpportunityId(opportunityId)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const typeRes = validateType(request.query.type);
    if (typeRes.error) {
      return response.status(400).json({
        success: false,
        message: typeRes.error,
      });
    }

    const userId = request.auth.userId;
    const result = await applicationService.getApplication(userId, opportunityId, typeRes.value);

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

export async function listApplications(request, response, next) {
  try {
    const { error, value } = validateApplicationQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await applicationService.listApplications(userId, value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}

export async function updateApplication(request, response, next) {
  try {
    const { opportunityId } = request.params;
    if (!validateOpportunityId(opportunityId)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const typeRes = validateType(request.query.type);
    if (typeRes.error) {
      return response.status(400).json({
        success: false,
        message: typeRes.error,
      });
    }

    const { error, value } = validateApplicationUpdate(request.body, typeRes.value);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const userId = request.auth.userId;
    const result = await applicationService.updateApplication(userId, opportunityId, typeRes.value, value);

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

export async function deleteApplication(request, response, next) {
  try {
    const { opportunityId } = request.params;
    if (!validateOpportunityId(opportunityId)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const typeRes = validateType(request.query.type);
    if (typeRes.error) {
      return response.status(400).json({
        success: false,
        message: typeRes.error,
      });
    }

    const userId = request.auth.userId;
    const result = await applicationService.deleteApplication(userId, opportunityId, typeRes.value);

    return response.status(result.status).json(result.data);
  } catch (error) {
    return next(error);
  }
}
