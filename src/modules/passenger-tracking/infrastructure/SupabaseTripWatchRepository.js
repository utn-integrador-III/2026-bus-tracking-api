"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const TABLE = "passenger_trip_watches";
const STOPS_TABLE = "stops";
const COLUMNS = "id, user_id, trip_id, stop_id, status, created_at, alerted_at";
const WATCH_COLUMNS = "id, user_id, trip_id, stop_id, status";

const STOPS_EMBED_FULL = "stops ( id, route_id, latitude, longitude, stop_order, geofence_radius_meters )";
const STOPS_EMBED_WITHOUT_RADIUS = "stops ( id, route_id, latitude, longitude, stop_order )";

const UNDEFINED_COLUMN_CODES = new Set(["42703", "PGRST204"]);

function isMissingRadiusColumn(error) {
  if (!error) return false;
  if (UNDEFINED_COLUMN_CODES.has(error.code)) return true;

  const message = `${error.message || ""} ${error.details || ""}`;
  return message.includes("geofence_radius_meters");
}

function logSchemaWarning(fields) {
  console.warn(JSON.stringify({ scope: "geofence_alerts", level: "warn", ...fields }));
}

class SupabaseTripWatchRepository {
  _writeError(error) {
    return new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.DATABASE_ERROR,
      "Error guardando el monitoreo de la parada.",
      error.message,
    );
  }

  async getStopById(stopId) {
    const { data, error } = await getServiceClient()
      .from(STOPS_TABLE)
      .select("id, route_id, stop_order")
      .eq("id", stopId)
      .maybeSingle();

    if (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        "Error obteniendo la parada solicitada.",
        error.message,
      );
    }
    return data || null;
  }

  async findWatch(userId, tripId) {
    const { data, error } = await getServiceClient()
      .from(TABLE)
      .select(COLUMNS)
      .eq("user_id", userId)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        "Error obteniendo el monitoreo existente.",
        error.message,
      );
    }
    return data || null;
  }

  async addWatch(userId, tripId, stopId) {
    const existing = await this.findWatch(userId, tripId);

    if (existing && existing.stop_id === stopId) {
      return { watch: existing, created: false };
    }

    if (existing) {
      const { data, error } = await getServiceClient()
        .from(TABLE)
        .update({ stop_id: stopId, status: "waiting", alerted_at: null })
        .eq("id", existing.id)
        .select(COLUMNS)
        .single();

      if (error) {
        throw this._writeError(error);
      }
      return { watch: data, created: false };
    }

    const { data, error } = await getServiceClient()
      .from(TABLE)
      .insert({ user_id: userId, trip_id: tripId, stop_id: stopId, status: "waiting" })
      .select(COLUMNS)
      .single();

    if (error) {
      throw this._writeError(error);
    }
    return { watch: data, created: true };
  }

  _selectActiveWatches(tripId, embed) {
    return getServiceClient()
      .from(TABLE)
      .select(`${WATCH_COLUMNS}, ${embed}`)
      .eq("trip_id", tripId)
      .in("status", ["waiting", "alerted"]);
  }

  async getActiveWatchesForTrip(tripId) {
    let { data, error } = await this._selectActiveWatches(tripId, STOPS_EMBED_FULL);

    if (error && isMissingRadiusColumn(error)) {
      logSchemaWarning({
        event: "stops_geofence_radius_column_missing",
        trip_id: tripId,
        error: error.message,
        fallback_radius_source: "service_default",
      });

      ({ data, error } = await this._selectActiveWatches(tripId, STOPS_EMBED_WITHOUT_RADIUS));
    }

    if (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR,
        "Error obteniendo monitoreos para el viaje.",
        error.message,
      );
    }

    const watches = data || [];

    for (const watch of watches) {
      if (!watch.stops) {
        logSchemaWarning({
          event: "stop_embed_unresolved",
          trip_id: tripId,
          watch_id: watch.id,
          stop_id: watch.stop_id,
        });
      }
    }

    return watches;
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
