"use strict";

const { verifyAccessToken } = require("../database/supabaseClient");
const { isValidRole, ROLES } = require("../constants/roles");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");
const asyncHandler = require("../utils/asyncHandler");

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") {
    return null;
  }
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }
  const token = parts[1].trim();
  return token.length > 0 ? token : null;
}

function resolveRoleFromUser(user) {
  const appMetadata = user.app_metadata || {};
  const userMetadata = user.user_metadata || {};
  const role = appMetadata.role || userMetadata.role;
  return isValidRole(role) ? role : ROLES.PASSENGER;
}

const requireAuth = asyncHandler(async function requireAuth(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.AUTH_TOKEN_MISSING,
      "Falta la cabecera Authorization con el token Bearer.",
    );
  }

  const user = await verifyAccessToken(token);
  req.auth = { userId: user.id, role: resolveRoleFromUser(user) };
  return next();
});

module.exports = requireAuth;
