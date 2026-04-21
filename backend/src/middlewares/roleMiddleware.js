const ApiError = require('../utils/ApiError');

function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized'));
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      return next(new ApiError(403, 'Forbidden'));
    }

    next();
  };
}

module.exports = authorize;
