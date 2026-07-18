"use strict";

const PassengerTrackingService = require("../tracking.service");

const TRIP_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const USER_ID = "15740dd7-9b7f-4838-aaf8-b59141e7edac";
const STOP_ID = "9f2504e0-4f89-41d3-9a0c-0305e82c3309";

function buildService(overrides = {}) {
  const watchRepository = {
    getActiveWatchesForTrip: jest.fn().mockResolvedValue(overrides.watches ?? []),
    markAsAlerted: jest.fn().mockResolvedValue(undefined),
  };
  const realtimeManager = { emitUserAlert: jest.fn() };
  const pushService = { sendGeofenceAlert: jest.fn().mockResolvedValue({ sent: true }) };

  const service = new PassengerTrackingService({
    watchRepository,
    realtimeManager,
    pushService,
    defaultRadiusMeters: 500,
  });

  return { service, watchRepository, realtimeManager, pushService };
}

function watchAt(latitude, longitude, radius) {
  return {
    id: "watch-1",
    user_id: USER_ID,
    trip_id: TRIP_ID,
    stop_id: STOP_ID,
    status: "waiting",
    stops: { latitude, longitude, geofence_radius_meters: radius },
  };
}

describe("PassengerTrackingService.checkProximity", () => {
  afterEach(() => jest.clearAllMocks());

  test("alerts with distance_m and passenger_id when bus is inside the radius", async () => {
    const { service, watchRepository, realtimeManager, pushService } = buildService({
      watches: [watchAt(0, 0, 500)],
    });

    await service.checkProximity(TRIP_ID, 0, 0);

    expect(watchRepository.markAsAlerted).toHaveBeenCalledWith(["watch-1"]);
    expect(realtimeManager.emitUserAlert).toHaveBeenCalledWith(
      USER_ID,
      "bus_approaching",
      expect.objectContaining({
        passenger_id: USER_ID,
        trip_id: TRIP_ID,
        stop_id: STOP_ID,
        distance_m: 0,
      }),
    );
    expect(pushService.sendGeofenceAlert).toHaveBeenCalledWith(
      expect.objectContaining({ passenger_id: USER_ID, distance_m: 0 }),
    );
  });

  test("does not alert when the bus is outside the radius", async () => {
    const { service, watchRepository, realtimeManager, pushService } = buildService({
      watches: [watchAt(0, 0.01, 500)],
    });

    await service.checkProximity(TRIP_ID, 0, 0);

    expect(watchRepository.markAsAlerted).not.toHaveBeenCalled();
    expect(realtimeManager.emitUserAlert).not.toHaveBeenCalled();
    expect(pushService.sendGeofenceAlert).not.toHaveBeenCalled();
  });

  test("swallows push failures without breaking the alert flow", async () => {
    const { service, pushService, watchRepository } = buildService({
      watches: [watchAt(0, 0, 500)],
    });
    pushService.sendGeofenceAlert.mockRejectedValueOnce(new Error("fcm down"));

    await expect(service.checkProximity(TRIP_ID, 0, 0)).resolves.toBeUndefined();
    expect(watchRepository.markAsAlerted).toHaveBeenCalledWith(["watch-1"]);
  });

  test("no-ops when there are no active watches", async () => {
    const { service, realtimeManager, pushService } = buildService({ watches: [] });

    await service.checkProximity(TRIP_ID, 0, 0);

    expect(realtimeManager.emitUserAlert).not.toHaveBeenCalled();
    expect(pushService.sendGeofenceAlert).not.toHaveBeenCalled();
  });
});
