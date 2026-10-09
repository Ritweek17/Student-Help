import { env } from '../config/env.js';
import {
  authenticateCredentials,
  clearRefreshCookie,
  createAccount,
  getAuthenticatedUser,
  revokeRefreshSession,
  rotateRefreshSession,
  setRefreshCookie,
} from '../services/auth.service.js';
import { validateLogin, validateSignup } from '../validators/auth.validator.js';

function duplicateEmailError() {
  const error = new Error('An account with this email already exists');
  error.statusCode = 409;
  return error;
}

export async function signup(request, response, next) {
  try {
    const meta = { ip: request.ip, userAgent: request.get('user-agent') };
    const account = await createAccount(validateSignup(request.body), meta);

    // Set rotating refresh token in HttpOnly cookie
    setRefreshCookie(response, account.refreshToken);

    // Return safe user and short-lived access token — never expose refresh token in JSON
    response.status(201).json({
      success: true,
      token: account.token,
      user: account.user,
    });
  } catch (error) {
    next(error.code === 11000 ? duplicateEmailError() : error);
  }
}

export async function login(request, response, next) {
  try {
    const { email, password } = validateLogin(request.body);
    const meta = { ip: request.ip, userAgent: request.get('user-agent') };
    const account = await authenticateCredentials(email, password, meta);

    // Set rotating refresh token in HttpOnly cookie
    setRefreshCookie(response, account.refreshToken);

    // Return safe user and short-lived access token — never expose refresh token in JSON
    response.status(200).json({
      success: true,
      token: account.token,
      user: account.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(request, response, next) {
  try {
    const rawToken = request.cookies?.[env.auth.refreshCookieName];
    if (!rawToken) {
      const error = new Error('Refresh token required');
      error.statusCode = 401;
      throw error;
    }

    const meta = { ip: request.ip, userAgent: request.get('user-agent') };
    const result = await rotateRefreshSession(rawToken, meta);

    // Set newly rotated refresh token in HttpOnly cookie
    setRefreshCookie(response, result.refreshToken);

    // Return safe user and renewed access token
    response.status(200).json({
      success: true,
      token: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    clearRefreshCookie(response);
    next(error);
  }
}

export async function logout(request, response, next) {
  try {
    const rawToken = request.cookies?.[env.auth.refreshCookieName];
    if (rawToken) {
      await revokeRefreshSession(rawToken);
    }
    clearRefreshCookie(response);
    response.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    clearRefreshCookie(response);
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
