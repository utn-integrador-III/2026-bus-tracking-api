"use strict";

const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const PARTS = ["body", "params", "query"];

function formatIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

function validate(schemas, code) {
  const errorCode = code || ERROR_CODES.ROUTE_VALIDATION_FAILED;
  return function validator(req, _res, next) {
    if (!req.valid) {
      req.valid = {};
    }
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) {
        continue;
      }
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        return next(
          new AppError(
            HTTP_STATUS.BAD_REQUEST,
            errorCode,
            `Validacion fallida en ${part}.`,
            formatIssues(result.error),
          ),
        );
      }
      req.valid[part] = result.data;
    }
    return next();
  };
}

module.exports = validate;
