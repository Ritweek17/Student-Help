import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

function unauthorized(response) {
  return response.status(401).json({
    success: false,
    message: 'Authentication required',
  });
}

export async function requireAuth(request, response, next) {
  const authorization = request.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return unauthorized(response);
  }

  try {
    const token = authorization.slice('Bearer '.length);
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select('_id role isActive');

    if (!user || !user.isActive) {
      return unauthorized(response);
    }

    request.auth = { userId: user._id.toString(), role: user.role };
    return next();
  } catch {
    return unauthorized(response);
  }
}
