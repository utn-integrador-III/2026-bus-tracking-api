"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const TABLE = "routes";
const COLUMNS = "id, name, origin, destination, geometry_geojson, is_active, created_at";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error al acceder a la base de datos de rutas.",
    error ? error.message : undefined,
  );
}

async function listRoutes({ includeInactive }) {
  let query = getServiceClient().from(TABLE).select(COLUMNS).order("created_at", { ascending: false });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    throw databaseError(error);
  }
  return data || [];
}

async function getRouteById(id) {
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

async function createRoute(payload) {
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

async function updateRoute(id, payload) {
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

async function setRouteActive(id, isActive) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update({ is_active: isActive })
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    throw databaseError(error);
  }
  return data || null;
}

module.exports = {
  listRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  setRouteActive,
};
