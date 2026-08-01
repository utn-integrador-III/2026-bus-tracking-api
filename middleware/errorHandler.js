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
    const isServerError = Number(err.statusCode) >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
    if (err.details !== undefined && (!isServerError || env.appDebug)) {
      body.error.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  const clientStatus = Number(err && (err.status || err.statusCode));
  if (Number.isInteger(clientStatus) && clientStatus >= 400 && clientStatus < 500) {
    const tooLarge = clientStatus === HTTP_STATUS.PAYLOAD_TOO_LARGE;
    return res.status(clientStatus).json({
      error: {
        code: tooLarge ? ERROR_CODES.PAYLOAD_TOO_LARGE : ERROR_CODES.BAD_REQUEST,
        message: tooLarge
          ? "Request body exceeds the allowed size limit."
          : "Invalid request payload.",
      },
    });
  }

  const body = {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Ocurrio un error interno inesperado.",
    },
  };
  if (env.appDebug && env.appEnv !== "production" && err) {
    body.error.details = String(err.message || err);
  }
  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(body);
}

module.exports = errorHandler;
