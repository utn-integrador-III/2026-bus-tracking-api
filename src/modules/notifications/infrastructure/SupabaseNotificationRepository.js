"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const PUSH_DEVICE_COLUMNS =
  "id, user_id, installation_id, target_type, platform, app_version, is_active, last_seen_at, created_at, updated_at";
const SUBSCRIPTION_COLUMNS =
  "id, passenger_id, trip_id, boarding_stop_id, destination_stop_id, alert_radius_meters, status, created_at";
const NOTIFICATION_COLUMNS =
  "id, user_id, trip_id, message, status, timestamp, event_id, notification_type, title, data, sent_at";

function databaseError(error, message) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    message,
    error ? error.message : undefined,
  );
}

function detourDatabaseError(error) {
  if (error && error.code === "23505") {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.TRIP_OPERATION_VALIDATION_FAILED,
      "Ya existe un desvio activo para este viaje.",
    );
  }
  return databaseError(error, "No se pudo registrar el desvio.");
}

class SupabaseNotificationRepository {
  async upsertPushDevice(userId, installationId, payload) {
    const { data, error } = await getServiceClient()
      .from("push_devices")
      .upsert(
        {
          user_id: userId,
          installation_id: installationId,
          target_type: payload.target_type,
          target_value: payload.target_value,
          platform: payload.platform,
          app_version: payload.app_version || null,
          is_active: true,
          disabled_at: null,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "installation_id" },
      )
      .select(PUSH_DEVICE_COLUMNS)
      .single();

    if (error) throw databaseError(error, "No se pudo registrar el dispositivo push.");
    return data;
  }

  async deactivatePushDevice(userId, installationId) {
    const now = new Date().toISOString();
    const { data, error } = await getServiceClient()
      .from("push_devices")
      .update({ is_active: false, disabled_at: now, updated_at: now })
      .eq("user_id", userId)
      .eq("installation_id", installationId)
      .select(PUSH_DEVICE_COLUMNS)
      .maybeSingle();

    if (error) throw databaseError(error, "No se pudo desactivar el dispositivo push.");
    return data || null;
  }

  async updateNotificationPreferences(userId, preferences) {
    const { data, error } = await getServiceClient()
      .from("passengers")
      .update({ notification_preferences: preferences })
      .eq("user_id", userId)
      .select("user_id, notification_preferences")
      .maybeSingle();

    if (error) throw databaseError(error, "No se pudieron actualizar las preferencias.");
    return data || null;
  }

  async getNotificationPreferences(userId) {
    const { data, error } = await getServiceClient()
      .from("passengers")
      .select("notification_preferences")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw databaseError(error, "No se pudieron consultar las preferencias.");
    return data ? data.notification_preferences || {} : null;
  }

  async findStopsByIds(stopIds) {
    if (stopIds.length === 0) return [];
    const { data, error } = await getServiceClient()
      .from("stops")
      .select("id, route_id")
      .in("id", stopIds);

    if (error) throw databaseError(error, "No se pudieron validar las paradas.");
    return data || [];
  }

  async upsertTripSubscription(userId, tripId, payload) {
    const { data, error } = await getServiceClient()
      .from("trip_subscriptions")
      .upsert(
        {
          passenger_id: userId,
          trip_id: tripId,
          boarding_stop_id: payload.boarding_stop_id || null,
          destination_stop_id: payload.destination_stop_id || null,
          alert_radius_meters: payload.alert_radius_meters || 500,
          status: "active",
        },
        { onConflict: "passenger_id,trip_id" },
      )
      .select(SUBSCRIPTION_COLUMNS)
      .single();

    if (error) throw databaseError(error, "No se pudo crear la suscripción al viaje.");
    return data;
  }

  async exitTripSubscription(userId, tripId) {
    const { data, error } = await getServiceClient()
      .from("trip_subscriptions")
      .update({ status: "exited" })
      .eq("passenger_id", userId)
      .eq("trip_id", tripId)
      .select(SUBSCRIPTION_COLUMNS)
      .maybeSingle();

    if (error) throw databaseError(error, "No se pudo finalizar la suscripción al viaje.");
    return data || null;
  }

  async listNotifications(userId, query) {
    const offset = (query.page - 1) * query.limit;
    let request = getServiceClient()
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .range(offset, offset + query.limit - 1);

    if (query.unread_only) request = request.neq("status", "Read");
    const { data, error } = await request;
    if (error) throw databaseError(error, "No se pudieron consultar las notificaciones.");
    return data || [];
  }

  async markNotificationRead(userId, notificationId) {
    const { data, error } = await getServiceClient()
      .from("notifications")
      .update({ status: "Read" })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .select(NOTIFICATION_COLUMNS)
      .maybeSingle();

    if (error) throw databaseError(error, "No se pudo marcar la notificación como leída.");
    return data || null;
  }

  async createDetour(payload) {
    const { data, error } = await getServiceClient()
      .from("trip_detours")
      .insert(payload)
      .select("id, trip_id, reported_by, resolved_by, reason, details, status, started_at, resolved_at")
      .single();

    if (error) throw detourDatabaseError(error);
    return data;
  }

  async resolveActiveDetour(tripId, actorUserId) {
    const now = new Date().toISOString();
    const { data, error } = await getServiceClient()
      .from("trip_detours")
      .update({ status: "resolved", resolved_at: now, updated_at: now, resolved_by: actorUserId })
      .eq("trip_id", tripId)
      .eq("status", "active")
      .select("id, trip_id, reported_by, resolved_by, reason, details, status, started_at, resolved_at")
      .maybeSingle();

    if (error) throw databaseError(error, "No se pudo resolver el desvío.");
    return data || null;
  }
}

module.exports = SupabaseNotificationRepository;
