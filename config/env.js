"use strict";
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

function parseEnvValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if (
    trimmed.length >= 2 &&
    (quote === "\"" || quote === "'") &&
    trimmed[trimmed.length - 1] === quote
  ) {
    const unquoted = trimmed.slice(1, -1);
    if (quote === "\"") {
      return unquoted
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t");
    }
    return unquoted;
  }
  return trimmed.replace(/\s+#.*$/, "");
}

function loadEnvFile() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue = ""] = match;
    if (process.env[key] === undefined) {
      process.env[key] = parseEnvValue(rawValue);
    }
  }
}

loadEnvFile();

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

  googleMapsApiKey: readString("GOOGLE_MAPS_API_KEY", ""),
  googleRoutesApiUrl: readString(
    "GOOGLE_ROUTES_API_URL",
    "https://routes.googleapis.com/directions/v2:computeRoutes",
  ),

  telemetryUpdateIntervalSeconds: readInt("TELEMETRY_UPDATE_INTERVAL_SECONDS", 2),
  enableSupabaseRealtime: readString("ENABLE_SUPABASE_REALTIME", "true") === "true",
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


function assertGoogleMapsConfig() {
  const missing = [];

  if (!env.googleMapsApiKey) {
    missing.push("GOOGLE_MAPS_API_KEY");
  }

  if (!env.googleRoutesApiUrl) {
    missing.push("GOOGLE_ROUTES_API_URL");
  }

  if (missing.length > 0) {
    throw new Error(
      `Configuracion de Google Maps incompleta. Faltan variables: ${missing.join(", ")}`,
    );
  }
}

module.exports = {
  env,
  assertSupabaseConfig,
  assertGoogleMapsConfig,
};