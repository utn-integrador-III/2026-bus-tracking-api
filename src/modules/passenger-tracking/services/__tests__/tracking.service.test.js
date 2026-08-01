"use strict";

const PassengerTrackingService = require("../tracking.service");
const { WATCH_STATUS, ALERT_EVENTS } = require("../tracking.service");

const STOP_LAT = 9.9281;
const STOP_LNG = -84.0907;
const FAR_LAT = 9.8644;
const FAR_LNG = -83.9194;
const NEAR_100M_LAT = 9.9291;

function buildStop(overrides = {}) {
  return {
    id: "stop-1",
    route_id: "route-1",
    latitude: STOP_LAT,
    longitude: STOP_LNG,
    stop_order: 3,
    geofence_radius_meters: 500,
    ...overrides,
  };
}

function buildWatch(overrides = {}) {
  return {
    id: "watch-1",
    user_id: "user-1",
    trip_id: "trip-1",
    stop_id: "stop-1",
    status: WATCH_STATUS.WAITING,
    stops: buildStop(),
    ...overrides,
  };
}

function buildRepository(overrides = {}) {
  return {
    addWatch: jest.fn().mockResolvedValue(undefined),
    getStopById: jest.fn().mockResolvedValue({ id: "stop-1", route_id: "route-1", stop_order: 3 }),
    findWatch: jest.fn().mockResolvedValue(null),
    getActiveWatchesForTrip: jest.fn().mockResolvedValue([]),
    markAsAlerted: jest.fn().mockResolvedValue(undefined),
    markAsPassed: jest.fn().mockResolvedValue(undefined),
    redirectWatch: jest.fn().mockResolvedValue(undefined),
    getNextStop: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function buildTripRepository(overrides = {}) {
  return {
    getTripById: jest.fn().mockResolvedValue({ id: "trip-1", route_id: "route-1" }),
    ...overrides,
  };
}

function buildRealtime() {
  return { emitUserAlert: jest.fn() };
}

function buildService(repo, realtime, extra = {}) {
  return new PassengerTrackingService({
    watchRepository: repo,
    realtimeManager: realtime,
    tripRepository: buildTripRepository(),
    ...extra,
  });
}

async function reportOutOfRange(service, times) {
  for (let index = 0; index < times; index += 1) {
    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);
  }
}

describe("PassengerTrackingService.watchStop", () => {
  it("delegates to the repository when the stop belongs to the trip route", async () => {
    const repo = buildRepository({
      addWatch: jest.fn().mockResolvedValue({ watch: { id: "watch-1" }, created: true }),
    });
    const service = buildService(repo, buildRealtime());

    const result = await service.watchStop("user-1", "trip-1", "stop-1");

    expect(repo.addWatch).toHaveBeenCalledWith("user-1", "trip-1", "stop-1");
    expect(result).toEqual({ watch: { id: "watch-1" }, created: true });
  });

  it("rejects a stop that belongs to a different route", async () => {
    const repo = buildRepository({
      getStopById: jest.fn().mockResolvedValue({ id: "stop-9", route_id: "route-B" }),
    });
    const service = buildService(repo, buildRealtime());

    await expect(service.watchStop("user-1", "trip-1", "stop-9")).rejects.toMatchObject({
      statusCode: 400,
      code: "WATCH_STOP_ROUTE_MISMATCH",
    });
    expect(repo.addWatch).not.toHaveBeenCalled();
  });

  it("rejects a stop that does not exist", async () => {
    const repo = buildRepository({ getStopById: jest.fn().mockResolvedValue(null) });
    const service = buildService(repo, buildRealtime());

    await expect(service.watchStop("user-1", "trip-1", "stop-x")).rejects.toMatchObject({
      statusCode: 400,
      code: "WATCH_STOP_NOT_FOUND",
    });
    expect(repo.addWatch).not.toHaveBeenCalled();
  });

  it("rejects when the trip does not exist", async () => {
    const repo = buildRepository();
    const service = buildService(repo, buildRealtime(), {
      tripRepository: buildTripRepository({ getTripById: jest.fn().mockResolvedValue(null) }),
    });

    await expect(service.watchStop("user-1", "trip-x", "stop-1")).rejects.toMatchObject({
      statusCode: 404,
      code: "TRIP_NOT_FOUND",
    });
    expect(repo.getStopById).not.toHaveBeenCalled();
    expect(repo.addWatch).not.toHaveBeenCalled();
  });

  it("rejects when the trip has no route assigned", async () => {
    const repo = buildRepository();
    const service = buildService(repo, buildRealtime(), {
      tripRepository: buildTripRepository({
        getTripById: jest.fn().mockResolvedValue({ id: "trip-1", route_id: null }),
      }),
    });

    await expect(service.watchStop("user-1", "trip-1", "stop-1")).rejects.toMatchObject({
      code: "WATCH_STOP_ROUTE_MISMATCH",
    });
  });
});

describe("PassengerTrackingService.checkProximity - approaching", () => {
  it("emits bus_approaching and marks as alerted when a waiting bus enters the geofence", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.WAITING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);

    expect(repo.markAsAlerted).toHaveBeenCalledWith(["watch-1"]);
    expect(realtime.emitUserAlert).toHaveBeenCalledWith("user-1", ALERT_EVENTS.APPROACHING, {
      trip_id: "trip-1",
      stop_id: "stop-1",
    });
    expect(repo.redirectWatch).not.toHaveBeenCalled();
    expect(repo.markAsPassed).not.toHaveBeenCalled();
  });

  it("does not emit when a waiting bus is still outside the geofence", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.WAITING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);

    expect(realtime.emitUserAlert).not.toHaveBeenCalled();
    expect(repo.markAsAlerted).not.toHaveBeenCalled();
  });

  it("respects the per-stop geofence radius over the default", async () => {
    const watch = buildWatch({
      status: WATCH_STATUS.WAITING,
      stops: buildStop({ geofence_radius_meters: 50 }),
    });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", NEAR_100M_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).not.toHaveBeenCalled();
    expect(repo.markAsAlerted).not.toHaveBeenCalled();
  });

  it("falls back to the default radius when the stop has no configured radius", async () => {
    const watch = buildWatch({
      status: WATCH_STATUS.WAITING,
      stops: buildStop({ geofence_radius_meters: null }),
    });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime, { defaultRadiusMeters: 500 });

    await service.checkProximity("trip-1", NEAR_100M_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).toHaveBeenCalledWith("user-1", ALERT_EVENTS.APPROACHING, expect.any(Object));
  });
});

describe("PassengerTrackingService.checkProximity - passed / redirect", () => {
  it("emits bus_passed and redirects the watch to the next stop when the bus leaves the geofence", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.APPROACHING });
    const nextStop = { id: "stop-2", name: "Central Market", stop_order: 4 };
    const repo = buildRepository({
      getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]),
      getNextStop: jest.fn().mockResolvedValue(nextStop),
    });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await reportOutOfRange(service, 3);

    expect(repo.getNextStop).toHaveBeenCalledWith("route-1", 3);
    expect(repo.redirectWatch).toHaveBeenCalledWith("watch-1", "stop-2");
    expect(repo.markAsPassed).not.toHaveBeenCalled();
    expect(realtime.emitUserAlert).toHaveBeenCalledWith("user-1", ALERT_EVENTS.PASSED, {
      trip_id: "trip-1",
      stop_id: "stop-1",
      redirected: true,
      next_stop: { id: "stop-2", name: "Central Market", stop_order: 4 },
    });
  });

  it("emits bus_passed without redirect when there is no next stop", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.APPROACHING });
    const repo = buildRepository({
      getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]),
      getNextStop: jest.fn().mockResolvedValue(null),
    });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await reportOutOfRange(service, 3);

    expect(repo.markAsPassed).toHaveBeenCalledWith(["watch-1"]);
    expect(repo.redirectWatch).not.toHaveBeenCalled();
    expect(realtime.emitUserAlert).toHaveBeenCalledWith("user-1", ALERT_EVENTS.PASSED, {
      trip_id: "trip-1",
      stop_id: "stop-1",
      redirected: false,
      next_stop: null,
    });
  });

  it("does not treat a still-approaching bus as passed", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.APPROACHING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).not.toHaveBeenCalled();
    expect(repo.markAsPassed).not.toHaveBeenCalled();
    expect(repo.redirectWatch).not.toHaveBeenCalled();
  });

  it("marks as passed without redirect when the stop lacks route ordering data", async () => {
    const watch = buildWatch({
      status: WATCH_STATUS.APPROACHING,
      stops: buildStop({ route_id: null, stop_order: null }),
    });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await reportOutOfRange(service, 3);

    expect(repo.getNextStop).not.toHaveBeenCalled();
    expect(repo.markAsPassed).toHaveBeenCalledWith(["watch-1"]);
    expect(realtime.emitUserAlert).toHaveBeenCalledWith(
      "user-1",
      ALERT_EVENTS.PASSED,
      expect.objectContaining({ redirected: false, next_stop: null }),
    );
  });
});

describe("PassengerTrackingService.checkProximity - passed hysteresis", () => {
  function buildAlertedSetup(extra = {}) {
    const watch = buildWatch({ status: WATCH_STATUS.APPROACHING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    return { watch, repo, realtime, service: buildService(repo, realtime, extra) };
  }

  it("does not mark as passed on a single out-of-range sample", async () => {
    const { repo, realtime, service } = buildAlertedSetup();

    await reportOutOfRange(service, 1);

    expect(repo.markAsPassed).not.toHaveBeenCalled();
    expect(repo.redirectWatch).not.toHaveBeenCalled();
    expect(realtime.emitUserAlert).not.toHaveBeenCalled();
  });

  it("does not mark as passed until the configured number of consecutive samples is reached", async () => {
    const { repo, service } = buildAlertedSetup();

    await reportOutOfRange(service, 2);
    expect(repo.markAsPassed).not.toHaveBeenCalled();

    await reportOutOfRange(service, 1);
    expect(repo.markAsPassed).toHaveBeenCalledWith(["watch-1"]);
  });

  it("resets the counter when the bus comes back inside the geofence", async () => {
    const { repo, service } = buildAlertedSetup();

    await reportOutOfRange(service, 2);
    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);
    await reportOutOfRange(service, 2);

    expect(repo.markAsPassed).not.toHaveBeenCalled();
  });

  it("does not count a sample that is still within the exit buffer", async () => {
    const { repo, service } = buildAlertedSetup({
      defaultRadiusMeters: 500,
      passedExitBufferMeters: 100000,
    });

    await reportOutOfRange(service, 5);

    expect(repo.markAsPassed).not.toHaveBeenCalled();
  });

  it("honours a custom confirmation threshold", async () => {
    const { repo, service } = buildAlertedSetup({ passedConfirmationSamples: 1 });

    await reportOutOfRange(service, 1);

    expect(repo.markAsPassed).toHaveBeenCalledWith(["watch-1"]);
  });

  it("keeps counters of other trips isolated", async () => {
    const watchA = buildWatch({ id: "watch-a", trip_id: "trip-1" });
    const watchB = buildWatch({ id: "watch-b", trip_id: "trip-2" });
    const repo = buildRepository({
      getActiveWatchesForTrip: jest.fn().mockImplementation(async (tripId) => {
        return tripId === "trip-1"
          ? [{ ...watchA, status: WATCH_STATUS.APPROACHING }]
          : [{ ...watchB, status: WATCH_STATUS.APPROACHING }];
      }),
    });
    const service = buildService(repo, buildRealtime());

    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);
    await service.checkProximity("trip-2", FAR_LAT, FAR_LNG);
    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);

    expect(service.outOfRangeSamples.get("trip-1|watch-a")).toBe(2);
    expect(service.outOfRangeSamples.get("trip-2|watch-b")).toBe(1);
  });

  it("drops counters for watches that are no longer active", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.APPROACHING });
    const repo = buildRepository({
      getActiveWatchesForTrip: jest
        .fn()
        .mockResolvedValueOnce([watch])
        .mockResolvedValueOnce([watch])
        .mockResolvedValueOnce([])
        .mockResolvedValue([watch]),
    });
    const service = buildService(repo, buildRealtime());

    await reportOutOfRange(service, 4);

    expect(repo.markAsPassed).not.toHaveBeenCalled();
    expect(service.outOfRangeSamples.get("trip-1|watch-1")).toBe(1);
  });
});

describe("PassengerTrackingService.checkProximity - mixed and edge cases", () => {
  it("handles approaching and passed watches within the same location update", async () => {
    const approachingWatch = buildWatch({
      id: "watch-approach",
      user_id: "user-approach",
      status: WATCH_STATUS.WAITING,
    });
    const passingWatch = buildWatch({
      id: "watch-pass",
      user_id: "user-pass",
      status: WATCH_STATUS.APPROACHING,
      stops: buildStop({ latitude: FAR_LAT, longitude: FAR_LNG, stop_order: 5 }),
    });
    const repo = buildRepository({
      getActiveWatchesForTrip: jest.fn().mockResolvedValue([approachingWatch, passingWatch]),
      getNextStop: jest.fn().mockResolvedValue(null),
    });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);
    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);
    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).toHaveBeenCalledWith("user-approach", ALERT_EVENTS.APPROACHING, expect.any(Object));
    expect(realtime.emitUserAlert).toHaveBeenCalledWith("user-pass", ALERT_EVENTS.PASSED, expect.any(Object));
    expect(repo.markAsAlerted).toHaveBeenCalledWith(["watch-approach"]);
    expect(repo.markAsPassed).toHaveBeenCalledWith(["watch-pass"]);
  });

  it("does nothing when there are no active watches", async () => {
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).not.toHaveBeenCalled();
    expect(repo.markAsAlerted).not.toHaveBeenCalled();
    expect(repo.markAsPassed).not.toHaveBeenCalled();
  });

  it("skips watches without an embedded stop", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.WAITING, stops: null });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).not.toHaveBeenCalled();
  });

  it("swallows repository errors without throwing", async () => {
    const repo = buildRepository({
      getActiveWatchesForTrip: jest.fn().mockRejectedValue(new Error("db down")),
    });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(service.checkProximity("trip-1", STOP_LAT, STOP_LNG)).resolves.toBeUndefined();
    expect(realtime.emitUserAlert).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("does not fail when no realtime manager is configured", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.WAITING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const service = buildService(repo, undefined);

    await expect(service.checkProximity("trip-1", STOP_LAT, STOP_LNG)).resolves.toBeUndefined();
    expect(repo.markAsAlerted).toHaveBeenCalledWith(["watch-1"]);
  });
});

describe("PassengerTrackingService.checkProximity - push dispatch", () => {
  it("pushes bus_approaching alongside the realtime broadcast", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.WAITING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const pushService = { sendAlert: jest.fn().mockResolvedValue(true) };
    const service = buildService(repo, realtime, { pushService });

    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).toHaveBeenCalledWith("user-1", ALERT_EVENTS.APPROACHING, expect.any(Object));
    expect(pushService.sendAlert).toHaveBeenCalledWith("user-1", ALERT_EVENTS.APPROACHING, {
      trip_id: "trip-1",
      stop_id: "stop-1",
    });
  });

  it("pushes bus_passed alongside the realtime broadcast", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.APPROACHING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const pushService = { sendAlert: jest.fn().mockResolvedValue(true) };
    const service = buildService(repo, realtime, { pushService });

    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);

    expect(pushService.sendAlert).toHaveBeenCalledWith(
      "user-1",
      ALERT_EVENTS.PASSED,
      expect.objectContaining({ trip_id: "trip-1", stop_id: "stop-1" }),
    );
  });

  it("still broadcasts over realtime when no push service is configured", async () => {
    const watch = buildWatch({ status: WATCH_STATUS.WAITING });
    const repo = buildRepository({ getActiveWatchesForTrip: jest.fn().mockResolvedValue([watch]) });
    const realtime = buildRealtime();
    const service = buildService(repo, realtime);

    await service.checkProximity("trip-1", STOP_LAT, STOP_LNG);

    expect(realtime.emitUserAlert).toHaveBeenCalledTimes(1);
  });
});
