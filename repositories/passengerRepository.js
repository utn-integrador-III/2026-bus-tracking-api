"use strict";

const SupabasePassengerProfileRepository = require("../src/modules/auth/infrastructure/SupabasePassengerProfileRepository");
const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const repository = new SupabasePassengerProfileRepository();

const TABLE = "passengers";
const COLUMNS =
  "user_id, phone, notification_preferences, is_senior, expo_push_token, birth_date, senior_status";

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
    .upsert(payload, { onConflict: "user_id" })
    .select(COLUMNS)
    .single();

  if (error) {
    throw databaseError(error);
  }

  return data;
}

async function findPassengerById(userId) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

async function updatePassengerProfile(userId, payload) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update(payload)
    .eq("user_id", userId)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

module.exports = {
  createPassengerProfile,
  findPassengerById,
  updatePassengerProfile,
  basePassengerProfileRepository: repository,
};