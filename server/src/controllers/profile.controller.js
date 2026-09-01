import { getProfileForUser, updateProfileForUser } from '../services/profile.service.js';
import { validateProfileUpdate } from '../validators/profile.validator.js';

export async function getProfile(request, response, next) {
  try {
    const profile = await getProfileForUser(request.auth.userId);
    if (!profile) {
      const error = new Error('Profile not found');
      error.statusCode = 404;
      throw error;
    }

    response.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(request, response, next) {
  try {
    const sanitizedData = validateProfileUpdate(request.body);
    const profile = await updateProfileForUser(request.auth.userId, sanitizedData);
    if (!profile) {
      const error = new Error('Profile not found');
      error.statusCode = 404;
      throw error;
    }

    response.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      error.statusCode = 400;
    }
    next(error);
  }
}
