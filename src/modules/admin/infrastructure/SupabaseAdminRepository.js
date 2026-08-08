"use strict";

const { getServiceClient } = require("../../../../database/supabaseClient");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const BUSES_TABLE = "buses";
const BUS_COLUMNS = "id, plate_number, capacity, status, created_at";

const STOPS_TABLE = "stops";
const STOP_COLUMNS =
  "id, route_id, name, latitude, longitude, stop_order, geofence_radius_meters";

const REPORTS_TABLE = "reports";
const REPORT_COLUMNS =
  "id, trip_id, user_id, type, description, latitude, longitude, timestamp, moderation_status";

const LOCATIONS_TABLE = "locations";
const LOCATION_COLUMNS = "id, trip_id, latitude, longitude, speed, heading, recorded_at";

const USERS_TABLE = "users";
const USER_COLUMNS = "id, name, email, is_active, deactivated_at, created_at";

const USER_ROLES_TABLE = "user_roles";
const USER_ROLE_COLUMNS = "id, user_id, role, license_number, employee_code, assigned_at";

function databaseError(error, message = "Error while accessing admin data.") {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    message,
    error ? error.message : undefined,
  );
}

class SupabaseAdminRepository {
  async listBuses() {
    const { data, error } = await getServiceClient()
      .from(BUSES_TABLE)
      .select(BUS_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      throw databaseError(error, "Error while accessing buses data.");
    }
    return data || [];
  }

  async listStops(routeId) {
    let query = getServiceClient()
      .from(STOPS_TABLE)
      .select(STOP_COLUMNS)
      .order("stop_order", { ascending: true });

    if (routeId) {
      query = query.eq("route_id", routeId);
    }

    const { data, error } = await query;
    if (error) {
      throw databaseError(error, "Error while accessing stops data.");
    }
    return data || [];
  }

  async createStop(payload) {
    const { data, error } = await getServiceClient()
      .from(STOPS_TABLE)
      .insert(payload)
      .select(STOP_COLUMNS)
      .single();

    if (error) {
      throw databaseError(error, "Error while creating stop data.");
    }
    return data;
  }

  async deleteStop(id) {
    const { data, error } = await getServiceClient()
      .from(STOPS_TABLE)
      .delete()
      .eq("id", id)
      .select(STOP_COLUMNS)
      .maybeSingle();

    if (error) {
      throw databaseError(error, "Error while deleting stop data.");
    }
    return data || null;
  }

  async listIncidents(status) {
    let query = getServiceClient()
      .from(REPORTS_TABLE)
      .select(REPORT_COLUMNS)
      .order("timestamp", { ascending: false });

    if (status) {
      query = query.eq("moderation_status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw databaseError(error, "Error while accessing incidents data.");
    }
    return data || [];
  }

  async getIncidentById(id) {
    const { data, error } = await getServiceClient()
      .from(REPORTS_TABLE)
      .select(REPORT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw databaseError(error, "Error while accessing incident data.");
    }
    return data || null;
  }

  async setIncidentModeration(id, moderationStatus, moderatedBy) {
    const { data, error } = await getServiceClient()
      .from(REPORTS_TABLE)
      .update({
        moderation_status: moderationStatus,
        moderated_by: moderatedBy,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(REPORT_COLUMNS)
      .maybeSingle();

    if (error) {
      throw databaseError(error, "Error while updating incident data.");
    }
    return data || null;
  }

  async getTelemetryHistory(tripId, startTime, endTime) {
    let query = getServiceClient()
      .from(LOCATIONS_TABLE)
      .select(LOCATION_COLUMNS)
      .eq("trip_id", tripId)
      .order("recorded_at", { ascending: true });

    if (startTime) {
      query = query.gte("recorded_at", startTime);
    }
    if (endTime) {
      query = query.lte("recorded_at", endTime);
    }

    const { data, error } = await query;
    if (error) {
      throw databaseError(error, "Error while accessing telemetry data.");
    }
    return data || [];
  }

  async listUsers(role) {
    let userQuery = getServiceClient()
      .from(USERS_TABLE)
      .select(USER_COLUMNS)
      .order("created_at", { ascending: false });

    let roleQuery = getServiceClient()
      .from(USER_ROLES_TABLE)
      .select(USER_ROLE_COLUMNS)
      .order("assigned_at", { ascending: false });

    if (role) {
      roleQuery = roleQuery.eq("role", role);
    }

    const [{ data: users, error: usersError }, { data: roles, error: rolesError }] =
      await Promise.all([userQuery, roleQuery]);

    if (usersError) {
      throw databaseError(usersError, "Error while accessing users data.");
    }
    if (rolesError) {
      throw databaseError(rolesError, "Error while accessing user roles data.");
    }

    const roleByUser = new Map();
    for (const row of roles || []) {
      if (!roleByUser.has(row.user_id)) {
        roleByUser.set(row.user_id, row.role);
      }
    }

    return (users || []).map((user) => ({
      ...user,
      role: roleByUser.get(user.id) || null,
    }));
  }
}

module.exports = SupabaseAdminRepository;
