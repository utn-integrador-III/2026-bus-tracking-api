"use strict";

const { DriverTripService } = require("../index");
const { TRIP_STATUS } = require("../../../../constants/tripStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const DRIVER_ID = "driver-1";
const TRIP_ID = "trip-1";

function trip(overrides = {}) {
  return {
    id: TRIP_ID,
    driver_id: DRIVER_ID,
    status: TRIP_STATUS.IN_PROGRESS,
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  return {
    tripRepository: {
      getTripById: jest.fn().mockResolvedValue(trip()),
      updateTrip: jest.fn().mockImplementation(async (_id, patch) => ({ ...trip(), ...patch })),
      findTripsByDriverId: jest.fn().mockResolvedValue([]),
    },
    locationRepository: {
      createLocation: jest.fn().mockResolvedValue({ id: 1, trip_id: TRIP_ID }),
    },
    realtimeManager: {
      startTracking: jest.fn().mockResolvedValue(undefined),
      stopTracking: jest.fn().mockResolvedValue(undefined),
      broadcastLocation: jest.fn().mockResolvedValue(undefined),
    },
    operationalRepository: {
      createDetour: jest.fn().mockResolvedValue({ id: "detour-1" }),
      resolveActiveDetour: jest.fn().mockResolvedValue({ id: "detour-1", status: "resolved" }),
    },
    ...overrides,
  };
}

describe("DriverTripService operational transitions", () => {
  test("starts an assigned scheduled trip and records the actor", async () => {
    const deps = dependencies();
    deps.tripRepository.getTripById.mockResolvedValue(trip({ status: TRIP_STATUS.SCHEDULED }));
    const service = new DriverTripService(deps);

    await service.startTrip(DRIVER_ID, TRIP_ID);

    expect(deps.tripRepository.updateTrip).toHaveBeenCalledWith(
      TRIP_ID,
      expect.objectContaining({
        status: TRIP_STATUS.IN_PROGRESS,
        status_changed_by: DRIVER_ID,
        started_at: expect.any(String),
      }),
    );
    expect(deps.realtimeManager.startTracking).toHaveBeenCalledWith(TRIP_ID);
  });

  test("reports an unexpected delay with reason and ETA metadata", async () => {
    const deps = dependencies();
    const service = new DriverTripService(deps);

    await service.delayTrip(DRIVER_ID, TRIP_ID, {
      reason: "Accidente en carretera",
      estimated_delay_minutes: 25,
    });

    expect(deps.tripRepository.updateTrip).toHaveBeenCalledWith(TRIP_ID, {
      status: TRIP_STATUS.DELAYED,
      status_reason: "Accidente en carretera",
      status_metadata: { estimated_delay_minutes: 25 },
      status_changed_by: DRIVER_ID,
    });
  });

  test("rejects a delay before departure", async () => {
    const deps = dependencies();
    deps.tripRepository.getTripById.mockResolvedValue(trip({ status: TRIP_STATUS.SCHEDULED }));
    const service = new DriverTripService(deps);

    await expect(
      service.delayTrip(DRIVER_ID, TRIP_ID, { reason: "Salida tardia" }),
    ).rejects.toMatchObject({ statusCode: 409, code: ERROR_CODES.TRIP_VALIDATION_FAILED });
  });

  test("cancels a trip with an operational reason", async () => {
    const deps = dependencies();
    const service = new DriverTripService(deps);

    await service.cancelTrip(DRIVER_ID, TRIP_ID, { reason: "Falla mecanica" });

    expect(deps.tripRepository.updateTrip).toHaveBeenCalledWith(
      TRIP_ID,
      expect.objectContaining({
        status: TRIP_STATUS.CANCELLED,
        status_reason: "Falla mecanica",
        status_changed_by: DRIVER_ID,
      }),
    );
    expect(deps.realtimeManager.stopTracking).toHaveBeenCalledWith(TRIP_ID);
  });

  test("stores detour details without mutating the trip route", async () => {
    const deps = dependencies();
    const service = new DriverTripService(deps);
    const payload = {
      reason: "Cierre temporal",
      affected_stop_ids: ["3f2504e0-4f89-41d3-9a0c-0305e82c3301"],
    };

    await service.reportDetour(DRIVER_ID, TRIP_ID, payload);

    expect(deps.operationalRepository.createDetour).toHaveBeenCalledWith({
      trip_id: TRIP_ID,
      reported_by: DRIVER_ID,
      reason: "Cierre temporal",
      details: { affected_stop_ids: payload.affected_stop_ids },
    });
    expect(deps.tripRepository.updateTrip).not.toHaveBeenCalled();
  });

  test("returns a typed error when no active detour can be resolved", async () => {
    const deps = dependencies();
    deps.operationalRepository.resolveActiveDetour.mockResolvedValue(null);
    const service = new DriverTripService(deps);

    await expect(service.resolveDetour(DRIVER_ID, TRIP_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: ERROR_CODES.ACTIVE_DETOUR_NOT_FOUND,
    });
  });

  test("accepts telemetry while a trip is delayed", async () => {
    const deps = dependencies();
    deps.tripRepository.getTripById.mockResolvedValue(trip({ status: TRIP_STATUS.DELAYED }));
    const service = new DriverTripService(deps);

    await service.reportLocation(DRIVER_ID, TRIP_ID, { latitude: 9.93, longitude: -84.08 });

    expect(deps.locationRepository.createLocation).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: TRIP_ID, latitude: 9.93, longitude: -84.08 }),
    );
  });
});
