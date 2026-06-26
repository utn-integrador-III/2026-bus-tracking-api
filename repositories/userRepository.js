"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const USERS_TABLE = "users";
const USER_ROLES_TABLE = "user_roles";

const USER_COLUMNS = "id, name, email, is_active, deactivated_at, created_at";
const ROLE_COLUMNS = "id, user_id, role, license_number, employee_code, assigned_at";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing users data.",
    error ? error.message : undefined,
  );
}

function splitUserPayload(payload) {
  const { role, license_number, employee_code, ...userPayload } = payload;

  return {
    userPayload,
    rolePayload: {
      role,
      license_number,
      employee_code,
    },
  };
}

async function findPrimaryRoleByUserId(userId) {
  const { data, error } = await getServiceClient()
    .from(USER_ROLES_TABLE)
    .select(ROLE_COLUMNS)
    .eq("user_id", userId)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

async function attachRole(user, preferredRole) {
  if (!user) {
    return null;
  }

  if (preferredRole) {
    return {
      ...user,
      role: preferredRole,
    };
  }

  const userRole = await findPrimaryRoleByUserId(user.id);

  return {
    ...user,
    role: userRole ? userRole.role : null,
  };
}

async function upsertUserRole(userId, rolePayload) {
  if (!rolePayload || !rolePayload.role) {
    return null;
  }

  const payload = {
    user_id: userId,
    role: rolePayload.role,
  };

  if (rolePayload.license_number !== undefined) {
    payload.license_number = rolePayload.license_number;
  }

  if (rolePayload.employee_code !== undefined) {
    payload.employee_code = rolePayload.employee_code;
  }

  const { data, error } = await getServiceClient()
    .from(USER_ROLES_TABLE)
    .upsert(payload, { onConflict: "user_id,role" })
    .select(ROLE_COLUMNS)
    .single();

  if (error) {
    throw databaseError(error);
  }

  return data;
}

async function findUserByEmail(email) {
  const { data, error } = await getServiceClient()
    .from(USERS_TABLE)
    .select(USER_COLUMNS)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return attachRole(data || null);
}

async function findUserById(id) {
  const { data, error } = await getServiceClient()
    .from(USERS_TABLE)
    .select(USER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return attachRole(data || null);
}

async function createUserProfile(payload) {
  const { userPayload, rolePayload } = splitUserPayload(payload);

  const { data, error } = await getServiceClient()
    .from(USERS_TABLE)
    .upsert(userPayload, { onConflict: "id" })
    .select(USER_COLUMNS)
    .single();

  if (error) {
    throw databaseError(error);
  }

  if (rolePayload.role) {
    await upsertUserRole(data.id, rolePayload);
  }

  return attachRole(data, rolePayload.role);
}

async function updateUserProfile(id, payload) {
  const { userPayload, rolePayload } = splitUserPayload(payload);

  let user = null;

  if (Object.keys(userPayload).length > 0) {
    const { data, error } = await getServiceClient()
      .from(USERS_TABLE)
      .update(userPayload)
      .eq("id", id)
      .select(USER_COLUMNS)
      .maybeSingle();

    if (error) {
      throw databaseError(error);
    }

    user = data || null;
  } else {
    user = await findUserById(id);
  }

  if (rolePayload.role) {
    await upsertUserRole(id, rolePayload);
  }

  return attachRole(user, rolePayload.role);
}

async function setUserActive(id, isActive) {
  const payload = {
    is_active: isActive,
    deactivated_at: isActive ? null : new Date().toISOString(),
  };

  const { data, error } = await getServiceClient()
    .from(USERS_TABLE)
    .update(payload)
    .eq("id", id)
    .select(USER_COLUMNS)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return attachRole(data || null);
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUserProfile,
  updateUserProfile,
  setUserActive,
};