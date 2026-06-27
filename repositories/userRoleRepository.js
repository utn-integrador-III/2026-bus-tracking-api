"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const TABLE = "user_roles";
const COLUMNS = "id, user_id, role, license_number, employee_code, assigned_at";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing user roles data.",
    error ? error.message : undefined,
  );
}

async function createUserRole(payload) {
  const existing = await findRoleByUserIdAndRole(payload.user_id, payload.role);

  if (existing) {
    return updateRoleByUserIdAndRole(payload.user_id, payload.role, {
      license_number:
        payload.license_number !== undefined
          ? payload.license_number
          : existing.license_number,
      employee_code:
        payload.employee_code !== undefined
          ? payload.employee_code
          : existing.employee_code,
    });
  }

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

async function findRoleByUserId(userId) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

async function findRoleByUserIdAndRole(userId, role) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

async function listRolesByRole(role) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("role", role)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw databaseError(error);
  }

  return data || [];
}

async function updateRoleByUserIdAndRole(userId, role, payload) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update(payload)
    .eq("user_id", userId)
    .eq("role", role)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

module.exports = {
  createUserRole,
  findRoleByUserId,
  findRoleByUserIdAndRole,
  listRolesByRole,
  updateRoleByUserIdAndRole,
};