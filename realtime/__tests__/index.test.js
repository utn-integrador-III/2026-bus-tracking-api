"use strict";

const mockEnv = {
  enableSupabaseRealtime: true,
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
};

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("../../config/env", () => ({ env: mockEnv }));
jest.mock("ws", () => function MockWebSocket() {});

const { createClient } = require("@supabase/supabase-js");
const manager = require("../index");

function channelWithStatus(status = "SUBSCRIBED", error) {
  return {
    subscribe: jest.fn((callback) => callback(status, error)),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
  };
}

function setupClient(channel) {
  const client = { channel: jest.fn(() => channel) };
  createClient.mockReturnValue(client);
  return client;
}

describe("TripRealtimeManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    manager.channels.clear();
    manager.client = null;
    mockEnv.enableSupabaseRealtime = true;
  });

  test("creates and caches the Supabase realtime client", () => {
    const channel = channelWithStatus();
    setupClient(channel);
    expect(manager._getClient()).toBe(manager._getClient());
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      mockEnv.supabaseUrl,
      mockEnv.supabaseAnonKey,
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: expect.objectContaining({ transport: expect.any(Function) }),
      }),
    );
  });

  test("builds the expected trip channel name", () => {
    expect(manager._channelName("trip-1")).toBe("trip:trip-1:driver-location");
  });

  test("starts tracking after a successful subscription", async () => {
    const channel = channelWithStatus();
    const client = setupClient(channel);
    await expect(manager.startTracking("trip-1")).resolves.toBeUndefined();
    expect(client.channel).toHaveBeenCalledWith("trip:trip-1:driver-location");
    expect(manager.channels.get("trip-1")).toBe(channel);
  });

  test("skips starting tracking when disabled or already tracked", async () => {
    mockEnv.enableSupabaseRealtime = false;
    await expect(manager.startTracking("trip-1")).resolves.toBeUndefined();
    expect(createClient).not.toHaveBeenCalled();

    mockEnv.enableSupabaseRealtime = true;
    manager.channels.set("trip-1", channelWithStatus());
    await manager.startTracking("trip-1");
    expect(createClient).not.toHaveBeenCalled();
  });

  test("rejects failed subscriptions with provided and generated errors", async () => {
    const explicit = new Error("subscription failed");
    setupClient(channelWithStatus("CHANNEL_ERROR", explicit));
    await expect(manager.startTracking("trip-1")).rejects.toBe(explicit);

    manager.client = null;
    setupClient(channelWithStatus("TIMED_OUT"));
    await expect(manager.startTracking("trip-2"))
      .rejects.toThrow("Channel subscribe returned TIMED_OUT");
  });

  test("stops a tracked channel and ignores an unknown trip", async () => {
    const channel = channelWithStatus();
    manager.channels.set("trip-1", channel);
    await manager.stopTracking("trip-1");
    expect(channel.unsubscribe).toHaveBeenCalledTimes(1);
    expect(manager.channels.has("trip-1")).toBe(false);

    await expect(manager.stopTracking("missing")).resolves.toBeUndefined();
  });

  test("broadcasts a location with defaults", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-06T07:08:09.000Z"));
    const channel = channelWithStatus();
    manager.channels.set("trip-1", channel);
    await manager.broadcastLocation("trip-1", { latitude: 10, longitude: -84 });
    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "location",
      payload: {
        latitude: 10,
        longitude: -84,
        speed: null,
        heading: null,
        recorded_at: "2026-05-06T07:08:09.000Z",
        eta: null,
      },
    });
    jest.useRealTimers();
  });

  test("broadcasts explicit location values and ETA", async () => {
    const channel = channelWithStatus();
    manager.channels.set("trip-1", channel);
    await manager.broadcastLocation("trip-1", {
      latitude: 10,
      longitude: -84,
      speed: 0,
      heading: 180,
      recorded_at: "recorded",
    }, 12);
    expect(channel.send).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ speed: 0, heading: 180, recorded_at: "recorded", eta: 12 }),
    }));
  });

  test("skips broadcasts when disabled or no channel exists", async () => {
    mockEnv.enableSupabaseRealtime = false;
    await manager.broadcastLocation("trip-1", {});
    mockEnv.enableSupabaseRealtime = true;
    await manager.broadcastLocation("missing", {});
    expect(createClient).not.toHaveBeenCalled();
  });

  test("emits through an existing passenger alert channel", async () => {
    const channel = channelWithStatus();
    manager.channels.set("passenger:user-1:alerts", channel);
    await manager.emitUserAlert("user-1", "arrival", { stop_id: "stop-1" });
    expect(channel.subscribe).not.toHaveBeenCalled();
    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "arrival",
      payload: { stop_id: "stop-1" },
    });
    expect(channel.unsubscribe).not.toHaveBeenCalled();
  });

  test("creates and disposes a temporary passenger alert channel", async () => {
    const channel = channelWithStatus();
    const client = setupClient(channel);
    await manager.emitUserAlert("user-1", "arrival", { stop_id: "stop-1" });
    expect(client.channel).toHaveBeenCalledWith("passenger:user-1:alerts");
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.unsubscribe).toHaveBeenCalledTimes(1);
  });

  test("logs a failed temporary subscription and still disposes the channel", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const channel = channelWithStatus("CHANNEL_ERROR");
    setupClient(channel);
    await manager.emitUserAlert("user-1", "arrival", {});
    expect(spy).toHaveBeenCalledWith(
      "Error subscribing to temp channel:",
      "Subscribe failed: CHANNEL_ERROR",
    );
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.unsubscribe).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test("uses an explicit temporary subscription error", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const channel = channelWithStatus("CHANNEL_ERROR", new Error("explicit failure"));
    setupClient(channel);
    await manager.emitUserAlert("user-1", "arrival", {});
    expect(spy).toHaveBeenCalledWith("Error subscribing to temp channel:", "explicit failure");
    spy.mockRestore();
  });

  test("skips passenger alerts when realtime is disabled", async () => {
    mockEnv.enableSupabaseRealtime = false;
    await manager.emitUserAlert("user-1", "arrival", {});
    expect(createClient).not.toHaveBeenCalled();
  });

  test("stops every tracked channel", async () => {
    const first = channelWithStatus();
    const second = channelWithStatus();
    manager.channels.set("trip-1", first);
    manager.channels.set("trip-2", second);
    await manager.stopAllTracking();
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(second.unsubscribe).toHaveBeenCalledTimes(1);
    expect(manager.channels.size).toBe(0);
  });
});
