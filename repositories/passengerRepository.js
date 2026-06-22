"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const TABLE = "passengers";
const COLUMNS = "user_id, phone, notification_preferences, is_senior, expo_push_token";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing passengers data.",
    error ? error.message : undefined,
  );
}

async function createPassengerProfile(payload) {
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

module.exports = {
  createPassengerProfile,
};