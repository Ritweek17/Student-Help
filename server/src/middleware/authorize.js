export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (!request.auth) {
      return response.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(request.auth.role)) {
      return response.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    return next();
  };
}
