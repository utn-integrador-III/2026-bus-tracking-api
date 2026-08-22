"use strict";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("../../config/env", () => ({
  env: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
    supabaseServiceRoleKey: "service-key",
  },
  assertSupabaseConfig: jest.fn(),
}));
jest.mock("ws", () => function MockWebSocket() {});

describe("supabaseClient", () => {
  let createClient;
  let assertSupabaseConfig;
  let database;

  beforeEach(() => {
    jest.resetModules();
    ({ createClient } = require("@supabase/supabase-js"));
    ({ assertSupabaseConfig } = require("../../config/env"));
    createClient.mockReset();
    assertSupabaseConfig.mockReset();
    database = require("../supabaseClient");
  });

  test("creates and caches the service client", () => {
    const client = { kind: "service" };
    createClient.mockReturnValue(client);
    expect(database.getServiceClient()).toBe(client);
    expect(database.getServiceClient()).toBe(client);
    expect(assertSupabaseConfig).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-key",
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: expect.objectContaining({ transport: expect.any(Function) }),
      }),
    );
  });

  test("creates and caches the anonymous client independently", () => {
    const anon = { kind: "anon" };
    createClient.mockReturnValue(anon);
    expect(database.getAnonClient()).toBe(anon);
    expect(database.getAnonClient()).toBe(anon);
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.any(Object),
    );
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  test("does not create a client when configuration validation fails", () => {
    assertSupabaseConfig.mockImplementation(() => { throw new Error("missing config"); });
    expect(database.getServiceClient).toThrow("missing config");
    expect(database.getAnonClient).toThrow("missing config");
    expect(createClient).not.toHaveBeenCalled();
  });

  test("verifies and returns the authenticated user", async () => {
    const user = { id: "user-1" };
    const getUser = jest.fn().mockResolvedValue({ data: { user }, error: null });
    createClient.mockReturnValue({ auth: { getUser } });
    await expect(database.verifyAccessToken("token")).resolves.toBe(user);
    expect(getUser).toHaveBeenCalledWith("token");
  });

  test.each([
    [{ data: { user: { id: "user-1" } }, error: { message: "invalid" } }],
    [{ data: null, error: null }],
    [{ data: {}, error: null }],
  ])("rejects invalid or incomplete auth responses %#", async (response) => {
    createClient.mockReturnValue({ auth: { getUser: jest.fn().mockResolvedValue(response) } });
    await expect(database.verifyAccessToken("token")).rejects.toMatchObject({
      statusCode: 401,
      code: "AUTH_TOKEN_INVALID",
      message: "Token de acceso invalido o expirado.",
    });
  });
});
