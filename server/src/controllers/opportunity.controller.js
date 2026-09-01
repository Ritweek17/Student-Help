import mongoose from 'mongoose';
import * as opportunityService from '../services/opportunity.service.js';
import { validateOpportunityQuery } from '../validators/opportunity.validator.js';

export async function listOpportunities(request, response, next) {
  try {
    const { error, value } = validateOpportunityQuery(request.query);
    if (error) {
      return response.status(400).json({
        success: false,
        message: error,
      });
    }

    const result = await opportunityService.listOpportunities(value);
    return response.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getOpportunityById(request, response, next) {
  try {
    const { id } = request.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid opportunity ID',
      });
    }

    const opportunity = await opportunityService.getOpportunityById(id);
    if (!opportunity) {
      return response.status(404).json({
        success: false,
        message: 'Opportunity not found',
      });
    }

    return response.status(200).json({
      success: true,
      opportunity,
    });
  } catch (error) {
    return next(error);
  }
}
