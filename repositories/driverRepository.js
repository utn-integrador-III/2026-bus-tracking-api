"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const TABLE = "drivers";
const COLUMNS = "user_id, license_number";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing drivers data.",
    error ? error.message : undefined,
  );
}

async function listDriverProfiles() {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS);

  if (error) {
    throw databaseError(error);
  }

  return data || [];
}

async function findDriverProfileByUserId(userId) {
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

async function createDriverProfile(payload) {
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

async function updateDriverProfile(userId, payload) {
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
  listDriverProfiles,
  findDriverProfileByUserId,
  createDriverProfile,
  updateDriverProfile,
};