"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const TABLE = "passenger_trip_watches";
const COLUMNS = "id, user_id, trip_id, stop_id, status, created_at, alerted_at";

class SupabaseTripWatchRepository {
  async addWatch(userId, tripId, stopId) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .upsert(
        { user_id: userId, trip_id: tripId, stop_id: stopId, status: "waiting" },
        { onConflict: "user_id,trip_id" }
      )
      .select(COLUMNS)
      .single();

    if (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        "Error guardando el monitoreo de la parada.",
        error.message,
      );
    }
    return data;
  }

  async getActiveWatchesForTrip(tripId) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .select(`
        id, user_id, trip_id, stop_id, status,
        stops ( latitude, longitude, geofence_radius_meters )
      `)
      .eq("trip_id", tripId)
      .eq("status", "waiting");

    if (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        "Error obteniendo monitoreos para el viaje.",
        error.message,
      );
    }
    return data || [];
  }

  async markAsAlerted(watchIds) {
    if (!watchIds || watchIds.length === 0) return;

    const { error } = await getServiceClient()
      .from(TABLE)
      .update({ status: "alerted", alerted_at: new Date().toISOString() })
      .in("id", watchIds);

    if (error) {
      console.error("Error updating watch status:", error.message);
    }
  }
}

module.exports = SupabaseTripWatchRepository;
