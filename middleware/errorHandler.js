"use strict";

const { env } = require("../config/env");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

function errorHandler(err, _req, res, _next) {
  if (err && err.isAppError) {
    const body = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details !== undefined) {
      body.error.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  const body = {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Ocurrio un error interno inesperado.",
    },
  };
  if (env.appEnv !== "production" && err) {
    body.error.details = String(err.message || err);
  }
  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(body);
}

module.exports = errorHandler;
