"use strict";

const { getServiceClient, getAnonClient } = require("../database/supabaseClient");
const userRepository = require("../repositories/userRepository");
const passengerRepository = require("../repositories/passengerRepository");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const PASSENGER_ROLE = "Passenger";

async function registerPassenger(payload) {
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
      role: PASSENGER_ROLE,
    },
  });

  if (error || !data || !data.user) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.AUTH_REGISTER_FAILED,
      "Passenger authentication account could not be created.",
      error ? error.message : undefined,
    );
  }

  const userProfile = await userRepository.createUserProfile({
    id: data.user.id,
    name: payload.name,
    email: payload.email,
    role: PASSENGER_ROLE,
  });

  const passengerProfile = await passengerRepository.createPassengerProfile({
    user_id: data.user.id,
    phone: payload.phone || null,
  });

  return {
    user: userProfile,
    passenger: passengerProfile,
  };
}

async function loginUser(payload) {
  const { data, error } = await getAnonClient().auth.signInWithPassword({
    email: payload.email,
    password: payload.password,
  });

  if (error || !data || !data.session || !data.user) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.AUTH_LOGIN_FAILED,
      "Invalid email or password.",
    );
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata ? data.user.user_metadata.role : null,
      name: data.user.user_metadata ? data.user.user_metadata.name : null,
    },
  };
}

module.exports = {
  registerPassenger,
  loginUser,
};