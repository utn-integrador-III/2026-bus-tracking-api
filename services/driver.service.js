"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const userRepository = require("../repositories/userRepository");
const userRoleRepository = require("../repositories/userRoleRepository");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const DRIVER_ROLE = "Driver";

function notFound() {
  return new AppError(
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.DRIVER_NOT_FOUND,
    "The requested driver does not exist.",
  );
}

function presentDriver(user, roleRecord) {
  return {
    user_id: user.id,
    name: user.name,
    email: user.email,
    role: roleRecord.role,
    license_number: roleRecord.license_number,
    is_active: user.is_active,
    deactivated_at: user.deactivated_at,
    created_at: user.created_at,
  };
}

async function listDrivers() {
  const roleRecords = await userRoleRepository.listRolesByRole(DRIVER_ROLE);

  const drivers = await Promise.all(
    roleRecords.map(async (roleRecord) => {
      const user = await userRepository.findUserById(roleRecord.user_id);
      return user ? presentDriver(user, roleRecord) : null;
    }),
  );

  return drivers.filter(Boolean);
}

async function getDriverById(id) {
  const user = await userRepository.findUserById(id);

  if (!user) {
    throw notFound();
  }

  const roleRecord = await userRoleRepository.findRoleByUserIdAndRole(id, DRIVER_ROLE);

  if (!roleRecord) {
    throw notFound();
  }

  return presentDriver(user, roleRecord);
}

async function createDriver(payload) {
  const existingUser = await userRepository.findUserByEmail(payload.email);

  if (existingUser) {
    throw new AppError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.AUTH_EMAIL_EXISTS,
      "A user with this email already exists.",
    );
  }

  const { data, error } = await getServiceClient().auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      name: payload.name,
      role: DRIVER_ROLE,
    },
  });

  if (error || !data || !data.user) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.DRIVER_CREATE_FAILED,
      "Driver authentication account could not be created.",
      error ? error.message : undefined,
    );
  }

  const userProfile = await userRepository.createUserProfile({
    id: data.user.id,
    name: payload.name,
    email: payload.email,
    is_active: true,
  });

  const roleRecord = await userRoleRepository.createUserRole({
    user_id: data.user.id,
    role: DRIVER_ROLE,
    license_number: payload.license_number,
  });

  return presentDriver(userProfile, roleRecord);
}

async function updateDriver(id, payload) {
  const current = await getDriverById(id);

  if (payload.email && payload.email !== current.email) {
    const existingUser = await userRepository.findUserByEmail(payload.email);

    if (existingUser && existingUser.id !== id) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.AUTH_EMAIL_EXISTS,
        "A user with this email already exists.",
      );
    }
  }

  const authPatch = {};

  if (payload.email !== undefined) {
    authPatch.email = payload.email;
  }

  if (payload.password !== undefined) {
    authPatch.password = payload.password;
  }

  if (payload.name !== undefined) {
    authPatch.user_metadata = {
      name: payload.name,
      role: DRIVER_ROLE,
    };
  }

  if (Object.keys(authPatch).length > 0) {
    const { error } = await getServiceClient().auth.admin.updateUserById(id, authPatch);

    if (error) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DRIVER_UPDATE_FAILED,
        "Driver authentication account could not be updated.",
        error.message,
      );
    }
  }

  const userPatch = {};

  if (payload.name !== undefined) {
    userPatch.name = payload.name;
  }

  if (payload.email !== undefined) {
    userPatch.email = payload.email;
  }

  if (Object.keys(userPatch).length > 0) {
    const updatedUser = await userRepository.updateUserProfile(id, userPatch);

    if (!updatedUser) {
      throw notFound();
    }
  }

  if (payload.license_number !== undefined) {
    const updatedRole = await userRoleRepository.updateRoleByUserIdAndRole(id, DRIVER_ROLE, {
      license_number: payload.license_number,
    });

    if (!updatedRole) {
      throw notFound();
    }
  }

  return getDriverById(id);
}

async function deactivateDriver(id) {
  await getDriverById(id);

  const updatedUser = await userRepository.setUserActive(id, false);

  if (!updatedUser) {
    throw notFound();
  }

  const roleRecord = await userRoleRepository.findRoleByUserIdAndRole(id, DRIVER_ROLE);

  return presentDriver(updatedUser, roleRecord);
}

module.exports = {
  listDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deactivateDriver,
};