"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const TABLE = "reports";
const COLUMNS = "id, trip_id, type, description, latitude, longitude, timestamp";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing incidents data.",
    error ? error.message : undefined,
  );
}

async function createPassengerIncident(payload) {
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

async function findIncidentsByTripId(tripId) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("trip_id", tripId)
    .order("timestamp", { ascending: false });

  if (error) {
    throw databaseError(error);
  }

  return data || [];
}

module.exports = {
  createPassengerIncident,
  findIncidentsByTripId,
};