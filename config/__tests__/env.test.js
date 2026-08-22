"use strict";

const originalEnv = process.env;

function loadEnv({ fileExists = false, fileContent = "" } = {}) {
  jest.resetModules();
  jest.doMock("dotenv", () => ({ config: jest.fn() }));
  jest.doMock("node:fs", () => ({
    existsSync: jest.fn(() => fileExists),
    readFileSync: jest.fn(() => fileContent),
  }));
  return require("../env");
}

describe("environment configuration", () => {
  beforeEach(() => {
    process.env = {};
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.dontMock("node:fs");
    jest.dontMock("dotenv");
  });

  test("loads all defaults when no env file exists", () => {
    const { env } = loadEnv();
    expect(env).toMatchObject({
      appEnv: "development",
      appDebug: false,
      appHost: "0.0.0.0",
      appPort: 8000,
      corsOrigins: [],
      telemetryUpdateIntervalSeconds: 2,
      enableSupabaseRealtime: true,
      stopProximityRadiusMeters: 500,
      enablePushNotifications: false,
      enableProximityWorker: false,
      proximityWorkerIntervalSeconds: 5,
      enableGoogleRoutes: true,
    });
    expect(Object.isFrozen(env)).toBe(true);
  });

  test("reads strings, integers, flags and comma-separated origins", () => {
    process.env = {
      APP_ENV: "test",
      APP_DEBUG: "true",
      APP_HOST: "127.0.0.1",
      APP_PORT: "9000",
      CORS_ORIGINS: "https://one.test, , https://two.test",
      SUPABASE_URL: "url",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      GOOGLE_MAPS_API_KEY: "google",
      GOOGLE_ROUTES_API_URL: "https://routes.test",
      TELEMETRY_UPDATE_INTERVAL_SECONDS: "10",
      ENABLE_SUPABASE_REALTIME: "false",
      STOP_PROXIMITY_RADIUS_METERS: "250",
      ENABLE_PUSH_NOTIFICATIONS: "true",
      SUPABASE_FUNCTIONS_URL: "https://functions.test",
      ENABLE_PROXIMITY_WORKER: "true",
      PROXIMITY_WORKER_INTERVAL_SECONDS: "15",
      ENABLE_GOOGLE_ROUTES: "false",
    };
    const { env } = loadEnv();
    expect(env).toMatchObject({
      appEnv: "test",
      appDebug: true,
      appHost: "127.0.0.1",
      appPort: 9000,
      corsOrigins: ["https://one.test", "https://two.test"],
      telemetryUpdateIntervalSeconds: 10,
      enableSupabaseRealtime: false,
      stopProximityRadiusMeters: 250,
      enablePushNotifications: true,
      enableProximityWorker: true,
      proximityWorkerIntervalSeconds: 15,
      enableGoogleRoutes: false,
    });
  });

  test("falls back for empty and invalid numeric values", () => {
    process.env = {
      APP_HOST: "",
      APP_PORT: "not-a-number",
      TELEMETRY_UPDATE_INTERVAL_SECONDS: "",
      STOP_PROXIMITY_RADIUS_METERS: "invalid",
    };
    const { env } = loadEnv();
    expect(env.appHost).toBe("0.0.0.0");
    expect(env.appPort).toBe(8000);
    expect(env.telemetryUpdateIntervalSeconds).toBe(2);
    expect(env.stopProximityRadiusMeters).toBe(500);
  });

  test("parses export syntax, quotes, escapes, comments and blank values from .env", () => {
    const { env } = loadEnv({
      fileExists: true,
      fileContent: [
        "export APP_ENV = staging",
        "APP_HOST='host # kept'",
        "CORS_ORIGINS= https://one.test,https://two.test # removed",
        "SUPABASE_URL=\"line\\nnext\\tvalue\\rend\"",
        "SUPABASE_ANON_KEY=",
        "NOT VALID",
        "# COMMENT",
      ].join("\n"),
    });
    expect(env.appEnv).toBe("staging");
    expect(env.appHost).toBe("host # kept");
    expect(env.corsOrigins).toEqual(["https://one.test", "https://two.test"]);
    expect(env.supabaseUrl).toBe("line\nnext\tvalue\rend");
    expect(env.supabaseAnonKey).toBe("");
  });

  test("does not overwrite variables already present in process.env", () => {
    process.env.APP_ENV = "existing";
    const { env } = loadEnv({ fileExists: true, fileContent: "APP_ENV=file\nAPP_PORT=7000" });
    expect(env.appEnv).toBe("existing");
    expect(env.appPort).toBe(7000);
  });

  test("accepts unquoted text with a non-comment hash", () => {
    const { env } = loadEnv({ fileExists: true, fileContent: "APP_HOST=host#fragment" });
    expect(env.appHost).toBe("host#fragment");
  });

  test("reports every missing Supabase setting", () => {
    const { assertSupabaseConfig } = loadEnv();
    expect(assertSupabaseConfig).toThrow(
      "Configuracion de Supabase incompleta. Faltan variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  test("reports only missing Supabase settings and succeeds when complete", () => {
    process.env = { SUPABASE_URL: "url", SUPABASE_ANON_KEY: "anon" };
    expect(loadEnv().assertSupabaseConfig).toThrow("SUPABASE_SERVICE_ROLE_KEY");

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    expect(loadEnv().assertSupabaseConfig).not.toThrow();
  });

  test("validates Google Maps configuration", () => {
    expect(loadEnv().assertGoogleMapsConfig).toThrow(
      "Configuracion de Google Maps incompleta. Faltan variables: GOOGLE_MAPS_API_KEY",
    );

    process.env.GOOGLE_MAPS_API_KEY = "google";
    expect(loadEnv().assertGoogleMapsConfig).not.toThrow();
  });
});
