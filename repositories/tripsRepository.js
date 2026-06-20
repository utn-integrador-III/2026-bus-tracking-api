"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const TABLE = "trips";
const COLUMNS =
  "id, route_id, bus_id, driver_id, departure_time, arrival_time, status, created_at, started_at, ended_at";

const FOREIGN_KEY_VIOLATION = "23503";

function databaseError(error) {
  if (error && error.code === FOREIGN_KEY_VIOLATION) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.TRIP_REFERENCE_INVALID,
      "route_id, bus_id o driver_id no corresponde a un registro existente.",
      error.details || error.message,
    );
  }
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error al acceder a la base de datos de viajes.",
    error ? error.message : undefined,
  );
}

async function listTrips({ statuses } = {}) {
  let query = getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .order("departure_time", { ascending: false });
  if (statuses) {
    query = query.in("status", statuses);
  }
  const { data, error } = await query;
  if (error) {
    throw databaseError(error);
  }
  return data || [];
}

async function getTripById(id) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw databaseError(error);
  }
  return data || null;
}

async function createTrip(payload) {
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

async function updateTrip(id, payload) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    throw databaseError(error);
  }
  return data || null;
}

async function setTripStatus(id, status) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ status })
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    throw databaseError(error);
  }
  return data || null;
}

module.exports = {
  listTrips,
  getTripById,
  createTrip,
  updateTrip,
  setTripStatus,
};
