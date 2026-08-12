"use strict";

const mockTrackingService = { checkProximity: jest.fn().mockResolvedValue(undefined) };

jest.mock("../../src/modules/passenger-tracking/index", () => ({
  createPassengerTrackingModule: jest.fn(() => ({ trackingService: mockTrackingService })),
}));

const { ProximityWorker } = require("../proximityWorker");
const { createProximityWorker } = require("../proximityWorker");

function createWorker(overrides = {}) {
  return new ProximityWorker({
    trackingService: { checkProximity: jest.fn().mockResolvedValue(undefined) },
    tripsRepository: { listTrips: jest.fn().mockResolvedValue([]) },
    locationRepository: { getLatestByTripId: jest.fn().mockResolvedValue(null) },
    statuses: ["in_progress"],
    intervalMs: 250,
    ...overrides,
  });
}

describe("ProximityWorker", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("processes locations for visible trips and skips trips without one", async () => {
    const trackingService = { checkProximity: jest.fn().mockResolvedValue(undefined) };
    const tripsRepository = {
      listTrips: jest.fn().mockResolvedValue([{ id: "trip-1" }, { id: "trip-2" }]),
    };
    const locationRepository = {
      getLatestByTripId: jest
        .fn()
        .mockResolvedValueOnce({ latitude: 10, longitude: -84 })
        .mockResolvedValueOnce(null),
    };
    const worker = createWorker({ trackingService, tripsRepository, locationRepository });

    await worker.tick();

    expect(tripsRepository.listTrips).toHaveBeenCalledWith({ statuses: ["in_progress"] });
    expect(locationRepository.getLatestByTripId).toHaveBeenCalledTimes(2);
    expect(trackingService.checkProximity).toHaveBeenCalledWith("trip-1", 10, -84);
  });

  test("stops ticking when there are no visible trips", async () => {
    const worker = createWorker();

    await worker.tick();

    expect(worker.locationRepository.getLatestByTripId).not.toHaveBeenCalled();
    expect(worker.trackingService.checkProximity).not.toHaveBeenCalled();
  });

  test("starts once and clears its scheduled timer when stopped", () => {
    const worker = createWorker();
    const schedule = jest.spyOn(worker, "_scheduleNext").mockImplementation(() => {});
    const clearTimer = jest.spyOn(global, "clearTimeout").mockImplementation(() => {});

    worker.start();
    worker.start();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(0);

    worker.timer = {};
    worker.stop();
    worker.stop();

    expect(clearTimer).toHaveBeenCalledTimes(1);
    expect(worker.timer).toBeNull();
  });

  test("schedules only when running and unreferences supported timers", () => {
    const worker = createWorker();
    const timer = { unref: jest.fn() };
    const setTimer = jest.spyOn(global, "setTimeout").mockReturnValue(timer);

    worker._scheduleNext(10);
    expect(setTimer).not.toHaveBeenCalled();

    worker.running = true;
    worker._scheduleNext(10);

    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 10);
    expect(timer.unref).toHaveBeenCalledTimes(1);
  });

  test("logs failed ticks and always schedules the next one", async () => {
    const worker = createWorker();
    const failure = new Error("repository unavailable");
    worker.tick = jest.fn().mockRejectedValue(failure);
    const schedule = jest.spyOn(worker, "_scheduleNext").mockImplementation(() => {});
    const logError = jest.spyOn(console, "error").mockImplementation(() => {});

    await worker._run();

    expect(logError).toHaveBeenCalledWith("ProximityWorker tick failed:", "repository unavailable");
    expect(schedule).toHaveBeenCalledWith(250);
  });

  test("creates workers with default and injected tracking services", () => {
    const injectedTrackingService = { checkProximity: jest.fn() };

    expect(createProximityWorker().trackingService).toBe(mockTrackingService);
    expect(createProximityWorker({ trackingService: injectedTrackingService }).trackingService)
      .toBe(injectedTrackingService);
  });
});
