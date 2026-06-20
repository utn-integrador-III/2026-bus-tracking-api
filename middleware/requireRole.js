"use strict";

const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

function requireRole(...allowed) {
  return function roleGuard(req, _res, next) {
    if (!req.auth || !req.auth.role) {
      return next(
        new AppError(
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.AUTH_TOKEN_MISSING,
          "Se requiere autenticacion para esta operacion.",
        ),
      );
    }
    if (!allowed.includes(req.auth.role)) {
      return next(
        new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN_ROLE,
          "El rol actual no tiene permisos para esta operacion.",
        ),
      );
    }
    return next();
  };
}

module.exports = requireRole;
