"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const TABLE = "locations";
const COLUMNS = "id, trip_id, latitude, longitude, speed, heading, recorded_at";

const REALTIME_TABLE = "trip_location";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing location data.",
    error ? error.message : undefined,
  );
}

function toRealtimeRow(location) {
  return {
    trip_id: location.trip_id,
    latitude: location.latitude,
    longitude: location.longitude,
    speed: location.speed ?? null,
    heading: location.heading ?? null,
    timestamp: location.recorded_at || new Date().toISOString(),
  };
}

async function mirrorToRealtime(locations) {
  try {
    const rows = Array.isArray(locations) ? locations : [locations];
    if (rows.length === 0) {
      return;
    }
    const { error } = await getServiceClient()
      .from(REALTIME_TABLE)
      .insert(rows.map(toRealtimeRow));
    if (error) {
      console.error("Error mirroring location into trip_location:", error.message);
    }
  } catch (err) {
    console.error("Error mirroring location into trip_location:", err ? err.message : String(err));
  }
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

    await mirrorToRealtime(data);
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

    await mirrorToRealtime(data || []);
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
