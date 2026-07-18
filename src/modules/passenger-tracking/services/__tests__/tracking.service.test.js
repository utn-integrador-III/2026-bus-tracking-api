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
    getActiveWatchesForTrip: jest.fn().mockResolvedValue([]),
    markAsAlerted: jest.fn().mockResolvedValue(undefined),
    markAsPassed: jest.fn().mockResolvedValue(undefined),
    redirectWatch: jest.fn().mockResolvedValue(undefined),
    getNextStop: jest.fn().mockResolvedValue(null),
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
    ...extra,
  });
}

describe("PassengerTrackingService.watchStop", () => {
  it("delegates to the repository", async () => {
    const repo = buildRepository({ addWatch: jest.fn().mockResolvedValue({ id: "watch-1" }) });
    const service = buildService(repo, buildRealtime());

    const result = await service.watchStop("user-1", "trip-1", "stop-1");

    expect(repo.addWatch).toHaveBeenCalledWith("user-1", "trip-1", "stop-1");
    expect(result).toEqual({ id: "watch-1" });
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

    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);

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

    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);

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

    await service.checkProximity("trip-1", FAR_LAT, FAR_LNG);

    expect(repo.getNextStop).not.toHaveBeenCalled();
    expect(repo.markAsPassed).toHaveBeenCalledWith(["watch-1"]);
    expect(realtime.emitUserAlert).toHaveBeenCalledWith(
      "user-1",
      ALERT_EVENTS.PASSED,
      expect.objectContaining({ redirected: false, next_stop: null }),
    );
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
