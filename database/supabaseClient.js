"use strict";

const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");
const { env, assertSupabaseConfig } = require("../config/env");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

let serviceClient = null;
let anonClient = null;

function getServiceClient() {
  if (serviceClient) {
    return serviceClient;
  }
  assertSupabaseConfig();
  serviceClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket },
  });
  return serviceClient;
}

function getAnonClient() {
  if (anonClient) {
    return anonClient;
  }
  assertSupabaseConfig();
  anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket },
  });
  return anonClient;
}

async function verifyAccessToken(token) {
  const client = getAnonClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data || !data.user) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.AUTH_TOKEN_INVALID,
      "Token de acceso invalido o expirado.",
    );
  }
  return data.user;
}

module.exports = { getServiceClient, getAnonClient, verifyAccessToken };
