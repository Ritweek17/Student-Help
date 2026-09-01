import { authenticateCredentials, createAccount, getAuthenticatedUser } from '../services/auth.service.js';
import { validateLogin, validateSignup } from '../validators/auth.validator.js';

function duplicateEmailError() {
  const error = new Error('An account with this email already exists');
  error.statusCode = 409;
  return error;
}

export async function signup(request, response, next) {
  try {
    const account = await createAccount(validateSignup(request.body));
    response.status(201).json({ success: true, ...account });
  } catch (error) {
    next(error.code === 11000 ? duplicateEmailError() : error);
  }
}

export async function login(request, response, next) {
  try {
    const { email, password } = validateLogin(request.body);
    const account = await authenticateCredentials(email, password);
    response.status(200).json({ success: true, ...account });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(request, response, next) {
  try {
    const user = await getAuthenticatedUser(request.auth.userId);
    if (!user || !user.isActive) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    response.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        profileId: user.profileId?.toString() ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
}
