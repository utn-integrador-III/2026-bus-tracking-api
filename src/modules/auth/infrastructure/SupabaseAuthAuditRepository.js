"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const TABLE = "auth_login_audit_logs";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing authentication audit data.",
    error ? error.message : undefined,
  );
}

class SupabaseAuthAuditRepository {
  async createLoginAuditLog(payload) {
    const { error } = await getServiceClient().from(TABLE).insert(payload);

    if (error) {
      throw databaseError(error);
    }
  }
}

module.exports = SupabaseAuthAuditRepository;