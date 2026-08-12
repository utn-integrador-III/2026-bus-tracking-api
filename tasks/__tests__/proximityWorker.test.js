"use strict";

const mockTrackingService = { checkProximity: jest.fn().mockResolvedValue(undefined) };

jest.mock("../../src/modules/passenger-tracking/index", () => ({
  createPassengerTrackingModule: jest.fn(() => ({ trackingService: mockTrackingService })),
}));

const { ProximityWorker, createProximityWorker } = require("../proximityWorker");

const TRIP_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const TRIP_B = "7f2504e0-4f89-41d3-9a0c-0305e82c3399";

function buildWorker(overrides = {}) {
  const trackingService = { checkProximity: jest.fn().mockResolvedValue(undefined) };
  const tripsRepository = {
    listTrips: jest.fn().mockResolvedValue(overrides.trips ?? []),
  };
  const locationRepository = {
    getLatestByTripId: jest.fn((tripId) =>
      Promise.resolve((overrides.locations ?? {})[tripId] ?? null),
    ),
  };

  const worker = new ProximityWorker({
    trackingService,
    tripsRepository,
    locationRepository,
    statuses: ["In_Progress"],
    intervalMs: 1000,
  });

  return { worker, trackingService, tripsRepository, locationRepository };
}

describe("ProximityWorker.tick", () => {
  afterEach(() => jest.clearAllMocks());

  test("runs proximity check for each active trip that has a latest location", async () => {
    const { worker, trackingService, tripsRepository } = buildWorker({
      trips: [{ id: TRIP_A }, { id: TRIP_B }],
      locations: {
        [TRIP_A]: { latitude: 9.93, longitude: -84.08 },
        [TRIP_B]: { latitude: 10.0, longitude: -84.1 },
      },
    });

    await worker.tick();

    expect(tripsRepository.listTrips).toHaveBeenCalledWith({ statuses: ["In_Progress"] });
    expect(trackingService.checkProximity).toHaveBeenCalledTimes(2);
    expect(trackingService.checkProximity).toHaveBeenCalledWith(TRIP_A, 9.93, -84.08);
    expect(trackingService.checkProximity).toHaveBeenCalledWith(TRIP_B, 10.0, -84.1);
  });

  test("skips trips without a latest location", async () => {
    const { worker, trackingService } = buildWorker({
      trips: [{ id: TRIP_A }, { id: TRIP_B }],
      locations: { [TRIP_A]: { latitude: 9.93, longitude: -84.08 } },
    });

    await worker.tick();

    expect(trackingService.checkProximity).toHaveBeenCalledTimes(1);
    expect(trackingService.checkProximity).toHaveBeenCalledWith(TRIP_A, 9.93, -84.08);
  });

  test("no-ops when there are no active trips", async () => {
    const { worker, trackingService, locationRepository } = buildWorker({ trips: [] });

    await worker.tick();

    expect(locationRepository.getLatestByTripId).not.toHaveBeenCalled();
    expect(trackingService.checkProximity).not.toHaveBeenCalled();
  });
});

describe("ProximityWorker scheduling", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("start schedules recursive ticks and stop halts them", async () => {
    const { worker, tripsRepository } = buildWorker({ trips: [] });

    worker.start();
    expect(worker.running).toBe(true);

    await jest.advanceTimersByTimeAsync(0);
    expect(tripsRepository.listTrips).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(tripsRepository.listTrips).toHaveBeenCalledTimes(2);

    worker.stop();
    expect(worker.running).toBe(false);

    await jest.advanceTimersByTimeAsync(5000);
    expect(tripsRepository.listTrips).toHaveBeenCalledTimes(2);
  });
});

describe("ProximityWorker edge cases", () => {
  afterEach(() => jest.restoreAllMocks());

  test("does not schedule when stopped and unreferences supported timers", () => {
    const { worker } = buildWorker();
    const timer = { unref: jest.fn() };
    const setTimer = jest.spyOn(global, "setTimeout").mockReturnValue(timer);

    worker._scheduleNext(10);
    expect(setTimer).not.toHaveBeenCalled();

    worker.running = true;
    worker._scheduleNext(10);

    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 10);
    expect(timer.unref).toHaveBeenCalledTimes(1);
  });

  test("logs failed ticks and schedules the next one", async () => {
    const { worker } = buildWorker();
    const failure = new Error("repository unavailable");
    worker.tick = jest.fn().mockRejectedValue(failure);
    const schedule = jest.spyOn(worker, "_scheduleNext").mockImplementation(() => {});
    const logError = jest.spyOn(console, "error").mockImplementation(() => {});

    await worker._run();

    expect(logError).toHaveBeenCalledWith("ProximityWorker tick failed:", "repository unavailable");
    expect(schedule).toHaveBeenCalledWith(1000);
  });

  test("creates workers with default and injected tracking services", () => {
    const injectedTrackingService = { checkProximity: jest.fn() };

    expect(createProximityWorker().trackingService).toBe(mockTrackingService);
    expect(createProximityWorker({ trackingService: injectedTrackingService }).trackingService)
      .toBe(injectedTrackingService);
  });
});
