"use strict";

jest.mock("../../../../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
}));

const { getServiceClient } = require("../../../../../database/supabaseClient");
const { createSupabaseMock } = require("../../../../../testUtils/supabaseMock");
const { ERROR_CODES } = require("../../../../../constants/errorCodes");
const SupabaseNotificationRepository = require("../SupabaseNotificationRepository");

const USER_ID = "user-1";
const TRIP_ID = "trip-1";
const DATABASE_FAILURE = { code: "PGRST500", message: "database unavailable" };

function setup(responses) {
  const mock = createSupabaseMock(responses);
  getServiceClient.mockReturnValue(mock.client);
  return { repository: new SupabaseNotificationRepository(), ...mock };
}

describe("SupabaseNotificationRepository", () => {
  test("upserts push devices with optional app versions", async () => {
    const first = { id: "device-1" };
    const second = { id: "device-2" };
    const { repository, queries } = setup([
      { data: first, error: null },
      { data: second, error: null },
    ]);

    await expect(repository.upsertPushDevice(USER_ID, "install-1", {
      target_type: "fid",
      target_value: "target-1",
      platform: "android",
    })).resolves.toBe(first);
    await expect(repository.upsertPushDevice(USER_ID, "install-2", {
      target_type: "token",
      target_value: "target-2",
      platform: "ios",
      app_version: "2.0.0",
    })).resolves.toBe(second);

    expect(queries[0].upsert.mock.calls[0][0]).toMatchObject({ app_version: null });
    expect(queries[1].upsert.mock.calls[0][0]).toMatchObject({ app_version: "2.0.0" });
  });

  test("wraps push-device database failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.upsertPushDevice(USER_ID, "install-1", {
      target_type: "fid",
      target_value: "target-1",
      platform: "android",
    })).rejects.toMatchObject({
      statusCode: 500,
      code: ERROR_CODES.DATABASE_ERROR,
      details: DATABASE_FAILURE.message,
    });
  });

  test("deactivates devices and normalizes an empty result", async () => {
    const device = { id: "device-1", is_active: false };
    const { repository, queries } = setup([
      { data: device, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.deactivatePushDevice(USER_ID, "install-1")).resolves.toBe(device);
    await expect(repository.deactivatePushDevice(USER_ID, "missing")).resolves.toBeNull();
    expect(queries[0].eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  test("wraps device deactivation failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.deactivatePushDevice(USER_ID, "install-1")).rejects.toMatchObject({
      code: ERROR_CODES.DATABASE_ERROR,
    });
  });

  test("updates preferences and normalizes an empty passenger", async () => {
    const preferences = { push_enabled: true, delay: false };
    const passenger = { user_id: USER_ID, notification_preferences: preferences };
    const { repository } = setup([
      { data: passenger, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.updateNotificationPreferences(USER_ID, preferences)).resolves.toBe(passenger);
    await expect(repository.updateNotificationPreferences(USER_ID, preferences)).resolves.toBeNull();
  });

  test("reads present, empty, and missing notification preferences", async () => {
    const preferences = { push_enabled: true };
    const { repository } = setup([
      { data: { notification_preferences: preferences }, error: null },
      { data: { notification_preferences: null }, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.getNotificationPreferences(USER_ID)).resolves.toEqual(preferences);
    await expect(repository.getNotificationPreferences(USER_ID)).resolves.toEqual({});
    await expect(repository.getNotificationPreferences(USER_ID)).resolves.toBeNull();
  });

  test.each([
    ["updateNotificationPreferences", [USER_ID, { delay: true }]],
    ["getNotificationPreferences", [USER_ID]],
  ])("wraps %s failures", async (method, args) => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository[method](...args)).rejects.toMatchObject({
      code: ERROR_CODES.DATABASE_ERROR,
    });
  });

  test("returns early for no stops and normalizes query data", async () => {
    const stops = [{ id: "stop-1", route_id: "route-1" }];
    const { repository, client } = setup([
      { data: stops, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.findStopsByIds([])).resolves.toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
    await expect(repository.findStopsByIds(["stop-1"])).resolves.toBe(stops);
    await expect(repository.findStopsByIds(["missing"])).resolves.toEqual([]);
  });

  test("wraps stop lookup failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.findStopsByIds(["stop-1"])).rejects.toMatchObject({
      code: ERROR_CODES.DATABASE_ERROR,
    });
  });

  test("upserts subscriptions with defaults and explicit values", async () => {
    const defaultSubscription = { id: "subscription-1" };
    const customSubscription = { id: "subscription-2" };
    const { repository, queries } = setup([
      { data: defaultSubscription, error: null },
      { data: customSubscription, error: null },
    ]);

    await expect(repository.upsertTripSubscription(USER_ID, TRIP_ID, {}))
      .resolves.toBe(defaultSubscription);
    await expect(repository.upsertTripSubscription(USER_ID, TRIP_ID, {
      boarding_stop_id: "stop-1",
      destination_stop_id: "stop-2",
      alert_radius_meters: 750,
    })).resolves.toBe(customSubscription);

    expect(queries[0].upsert.mock.calls[0][0]).toMatchObject({
      boarding_stop_id: null,
      destination_stop_id: null,
      alert_radius_meters: 500,
    });
    expect(queries[1].upsert.mock.calls[0][0]).toMatchObject({
      boarding_stop_id: "stop-1",
      destination_stop_id: "stop-2",
      alert_radius_meters: 750,
    });
  });

  test("wraps subscription upsert failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.upsertTripSubscription(USER_ID, TRIP_ID, {})).rejects.toMatchObject({
      code: ERROR_CODES.DATABASE_ERROR,
    });
  });

  test("exits subscriptions and normalizes an empty result", async () => {
    const subscription = { id: "subscription-1", status: "exited" };
    const { repository } = setup([
      { data: subscription, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.exitTripSubscription(USER_ID, TRIP_ID)).resolves.toBe(subscription);
    await expect(repository.exitTripSubscription(USER_ID, TRIP_ID)).resolves.toBeNull();
  });

  test("wraps subscription exit failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.exitTripSubscription(USER_ID, TRIP_ID)).rejects.toMatchObject({
      code: ERROR_CODES.DATABASE_ERROR,
    });
  });

  test("lists all or only unread notifications", async () => {
    const firstPage = [{ id: "notification-1" }];
    const { repository, queries } = setup([
      { data: firstPage, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.listNotifications(USER_ID, {
      page: 2,
      limit: 10,
      unread_only: true,
    })).resolves.toBe(firstPage);
    await expect(repository.listNotifications(USER_ID, {
      page: 1,
      limit: 25,
      unread_only: false,
    })).resolves.toEqual([]);

    expect(queries[0].range).toHaveBeenCalledWith(10, 19);
    expect(queries[0].neq).toHaveBeenCalledWith("status", "Read");
    expect(queries[1].neq).not.toHaveBeenCalled();
  });

  test("wraps notification listing failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.listNotifications(USER_ID, {
      page: 1,
      limit: 25,
      unread_only: false,
    })).rejects.toMatchObject({ code: ERROR_CODES.DATABASE_ERROR });
  });

  test("marks notifications as read and normalizes an empty result", async () => {
    const notification = { id: "notification-1", status: "Read" };
    const { repository } = setup([
      { data: notification, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.markNotificationRead(USER_ID, "notification-1"))
      .resolves.toBe(notification);
    await expect(repository.markNotificationRead(USER_ID, "missing")).resolves.toBeNull();
  });

  test("wraps notification update failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.markNotificationRead(USER_ID, "notification-1"))
      .rejects.toMatchObject({ code: ERROR_CODES.DATABASE_ERROR });
  });

  test("creates detours and maps duplicate conflicts", async () => {
    const detour = { id: "detour-1", trip_id: TRIP_ID };
    const { repository } = setup([
      { data: detour, error: null },
      { data: null, error: { code: "23505", message: "duplicate" } },
      { data: null, error: DATABASE_FAILURE },
    ]);

    await expect(repository.createDetour({ trip_id: TRIP_ID })).resolves.toBe(detour);
    await expect(repository.createDetour({ trip_id: TRIP_ID })).rejects.toMatchObject({
      statusCode: 409,
      code: ERROR_CODES.TRIP_OPERATION_VALIDATION_FAILED,
    });
    await expect(repository.createDetour({ trip_id: TRIP_ID })).rejects.toMatchObject({
      statusCode: 500,
      code: ERROR_CODES.DATABASE_ERROR,
    });
  });

  test("resolves active detours and normalizes an empty result", async () => {
    const detour = { id: "detour-1", status: "resolved" };
    const { repository } = setup([
      { data: detour, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.resolveActiveDetour(TRIP_ID, USER_ID)).resolves.toBe(detour);
    await expect(repository.resolveActiveDetour(TRIP_ID, USER_ID)).resolves.toBeNull();
  });

  test("wraps detour resolution failures", async () => {
    const { repository } = setup([{ data: null, error: DATABASE_FAILURE }]);

    await expect(repository.resolveActiveDetour(TRIP_ID, USER_ID)).rejects.toMatchObject({
      code: ERROR_CODES.DATABASE_ERROR,
    });
  });
});
