"use strict";

const { PushNotificationsService } = require("../pushNotifications.service");

const PASSENGER_ID = "15740dd7-9b7f-4838-aaf8-b59141e7edac";

describe("PushNotificationsService.sendGeofenceAlert", () => {
  test("posts the payload to the geofence-alert edge function", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: true }),
    });

    const service = new PushNotificationsService({
      fetchFn,
      functionsBaseUrl: "https://proj.functions.supabase.co/",
      authToken: "service-role-key",
      enabled: true,
    });

    const result = await service.sendGeofenceAlert({
      passenger_id: PASSENGER_ID,
      distance_m: 320,
      trip_id: "trip-1",
      stop_id: "stop-1",
    });

    expect(result).toEqual({ sent: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe("https://proj.functions.supabase.co/geofence-alert");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer service-role-key");
    expect(JSON.parse(options.body)).toEqual({
      passenger_id: PASSENGER_ID,
      distance_m: 320,
      trip_id: "trip-1",
      stop_id: "stop-1",
    });
  });

  test("skips the call when push notifications are disabled", async () => {
    const fetchFn = jest.fn();
    const service = new PushNotificationsService({
      fetchFn,
      functionsBaseUrl: "https://proj.functions.supabase.co",
      enabled: false,
    });

    const result = await service.sendGeofenceAlert({ passenger_id: PASSENGER_ID, distance_m: 10 });

    expect(result).toEqual({ skipped: true, reason: "push_disabled" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("throws when the edge function returns a non-ok response", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve("boom"),
    });

    const service = new PushNotificationsService({
      fetchFn,
      functionsBaseUrl: "https://proj.functions.supabase.co",
      authToken: "k",
      enabled: true,
    });

    await expect(
      service.sendGeofenceAlert({ passenger_id: PASSENGER_ID, distance_m: 10 }),
    ).rejects.toThrow(/geofence-alert function failed \(502\)/);
  });
});
