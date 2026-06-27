"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const TABLE = "locations";
const COLUMNS = "id, trip_id, latitude, longitude, speed, heading, recorded_at";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing location data.",
    error ? error.message : undefined,
  );
}

class SupabaseLocationRepository {
  async createLocation(payload) {
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

  async batchInsertLocations(locations) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .insert(locations)
      .select(COLUMNS);

    if (error) {
      throw databaseError(error);
    }
    return data || [];
  }

  async getLatestByTripId(tripId) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .select(COLUMNS)
      .eq("trip_id", tripId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw databaseError(error);
    }
    return data || null;
  }
}

module.exports = SupabaseLocationRepository;
