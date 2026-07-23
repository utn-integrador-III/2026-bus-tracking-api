"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const TABLE = "passenger_trip_watches";
const STOPS_TABLE = "stops";
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
        stops ( id, route_id, latitude, longitude, stop_order, geofence_radius_meters )
      `)
      .eq("trip_id", tripId)
      .in("status", ["waiting", "alerted"]);

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

  async getNextStop(routeId, currentStopOrder) {
    const { data, error } = await getServiceClient()
      .from(STOPS_TABLE)
      .select("id, name, stop_order")
      .eq("route_id", routeId)
      .gt("stop_order", currentStopOrder)
      .order("stop_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        "Error obteniendo la siguiente parada de la ruta.",
        error.message,
      );
    }
    return data || null;
  }

  async redirectWatch(watchId, nextStopId) {
    const { error } = await getServiceClient()
      .from(TABLE)
      .update({ stop_id: nextStopId, status: "waiting", alerted_at: null })
      .eq("id", watchId);

    if (error) {
      console.error("Error redirecting watch to next stop:", error.message);
    }
  }

  async markAsPassed(watchIds) {
    if (!watchIds || watchIds.length === 0) return;

    const { error } = await getServiceClient()
      .from(TABLE)
      .update({ status: "passed", alerted_at: new Date().toISOString() })
      .in("id", watchIds);

    if (error) {
      console.error("Error updating watch status to passed:", error.message);
    }
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
