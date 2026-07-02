"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const TABLE = "users";
const COLUMNS = "id, name, email, role, created_at";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing users data.",
    error ? error.message : undefined,
  );
}

class SupabaseUserRepository {
  async findUserById(userId) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .select(COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw databaseError(error);
    }
    return data || null;
  }

  async findUserByEmail(email) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .select(COLUMNS)
      .eq("email", email)
      .maybeSingle();

    if (error) {
      throw databaseError(error);
    }
    return data || null;
  }

  async createUserProfile(payload) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .insert(payload)
      .select(COLUMNS)
      .single();

    if (error) {
      throw databaseError(error);
    }
    return data;
  }
}

module.exports = SupabaseUserRepository;