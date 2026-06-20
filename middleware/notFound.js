"use strict";

const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

function notFound(req, _res, next) {
  next(
    new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.NOT_FOUND,
      `Recurso no encontrado: ${req.method} ${req.originalUrl}`,
    ),
  );
}

module.exports = notFound;
