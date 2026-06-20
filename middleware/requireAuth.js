"use strict";

const { env } = require("../config/env");
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

function resolveFromDevBypass(req) {
  const userId = req.headers["x-dev-user-id"];
  const role = req.headers["x-dev-role"];
  if (!userId || !role) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.AUTH_TOKEN_MISSING,
      "Bypass de desarrollo activo: faltan cabeceras x-dev-user-id / x-dev-role.",
    );
  }
  if (!isValidRole(role)) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.AUTH_TOKEN_INVALID,
      "Bypass de desarrollo: x-dev-role no es un rol valido.",
    );
  }
  return { userId: String(userId), role };
}

const requireAuth = asyncHandler(async function requireAuth(req, _res, next) {
  if (env.authDevBypass) {
    req.auth = resolveFromDevBypass(req);
    return next();
  }

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
