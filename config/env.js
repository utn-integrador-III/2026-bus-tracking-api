"use strict";

function readString(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  return String(raw);
}

function readInt(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function splitOrigins(value) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const env = Object.freeze({
  appEnv: readString("APP_ENV", "development"),
  appHost: readString("APP_HOST", "0.0.0.0"),
  appPort: readInt("APP_PORT", 8000),
  corsOrigins: splitOrigins(readString("CORS_ORIGINS", "")),
  supabaseUrl: readString("SUPABASE_URL", ""),
  supabaseAnonKey: readString("SUPABASE_ANON_KEY", ""),
  supabaseServiceRoleKey: readString("SUPABASE_SERVICE_ROLE_KEY", ""),
});

function assertSupabaseConfig() {
  const missing = [];
  if (!env.supabaseUrl) {
    missing.push("SUPABASE_URL");
  }
  if (!env.supabaseAnonKey) {
    missing.push("SUPABASE_ANON_KEY");
  }
  if (!env.supabaseServiceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (missing.length > 0) {
    throw new Error(
      `Configuracion de Supabase incompleta. Faltan variables: ${missing.join(", ")}`,
    );
  }
}

module.exports = { env, assertSupabaseConfig };
