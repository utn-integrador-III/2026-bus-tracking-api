"use strict";

const { DriverIncidentService } = require("../index");

const DRIVER_ID = "driver-1";
const TRIP_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function buildDependencies(overrides = {}) {
  return {
    tripRepository: {
      getTripById: jest.fn().mockResolvedValue({ id: TRIP_ID, driver_id: DRIVER_ID }),
    },
    locationRepository: {
      getLatestByTripId: jest.fn().mockResolvedValue({ speed: 0 }),
    },
    incidentsRepository: {
      createPassengerIncident: jest.fn().mockResolvedValue({ id: "incident-1" }),
    },
    ...overrides,
  };
}

function buildPayload(overrides = {}) {
  return {
    trip_id: TRIP_ID,
    type: "mechanical_failure",
    description: "Engine warning light",
    latitude: 9.9763,
    longitude: -84.8384,
    ...overrides,
  };
}

describe("DriverIncidentService.createIncident", () => {
  it("persists the incident when the vehicle is stopped", async () => {
    const dependencies = buildDependencies();
    const service = new DriverIncidentService(dependencies);

    const result = await service.createIncident(DRIVER_ID, buildPayload());

    expect(result).toEqual({ id: "incident-1" });
    expect(dependencies.incidentsRepository.createPassengerIncident).toHaveBeenCalledWith({
      trip_id: TRIP_ID,
      user_id: DRIVER_ID,
      type: "mechanical_failure",
      description: "Engine warning light",
      latitude: 9.9763,
      longitude: -84.8384,
    });
  });

  it("rejects with 409 when the request reports a speed greater than zero", async () => {
    const dependencies = buildDependencies();
    const service = new DriverIncidentService(dependencies);

    await expect(
      service.createIncident(DRIVER_ID, buildPayload({ speed: 12.5 })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "DRIVER_INCIDENT_SPEED_LOCKED",
      details: { speed: 12.5, source: "request" },
    });

    expect(dependencies.incidentsRepository.createPassengerIncident).not.toHaveBeenCalled();
    expect(dependencies.locationRepository.getLatestByTripId).not.toHaveBeenCalled();
  });

  it("rejects with 409 when the last known telemetry reports movement", async () => {
    const dependencies = buildDependencies({
      locationRepository: { getLatestByTripId: jest.fn().mockResolvedValue({ speed: 8 }) },
    });
    const service = new DriverIncidentService(dependencies);

    await expect(service.createIncident(DRIVER_ID, buildPayload())).rejects.toMatchObject({
      statusCode: 409,
      code: "DRIVER_INCIDENT_SPEED_LOCKED",
      details: { speed: 8, source: "telemetry" },
    });

    expect(dependencies.incidentsRepository.createPassengerIncident).not.toHaveBeenCalled();
  });

  it("allows the report when there is no telemetry yet", async () => {
    const dependencies = buildDependencies({
      locationRepository: { getLatestByTripId: jest.fn().mockResolvedValue(null) },
    });
    const service = new DriverIncidentService(dependencies);

    await expect(service.createIncident(DRIVER_ID, buildPayload())).resolves.toEqual({
      id: "incident-1",
    });
  });

  it("allows the report when telemetry speed is null", async () => {
    const dependencies = buildDependencies({
      locationRepository: { getLatestByTripId: jest.fn().mockResolvedValue({ speed: null }) },
    });
    const service = new DriverIncidentService(dependencies);

    await expect(service.createIncident(DRIVER_ID, buildPayload())).resolves.toEqual({
      id: "incident-1",
    });
  });

  it("rejects when the trip does not exist", async () => {
    const dependencies = buildDependencies({
      tripRepository: { getTripById: jest.fn().mockResolvedValue(null) },
    });
    const service = new DriverIncidentService(dependencies);

    await expect(service.createIncident(DRIVER_ID, buildPayload())).rejects.toMatchObject({
      statusCode: 404,
      code: "TRIP_NOT_FOUND",
    });
  });

  it("rejects when the trip belongs to another driver", async () => {
    const dependencies = buildDependencies({
      tripRepository: {
        getTripById: jest.fn().mockResolvedValue({ id: TRIP_ID, driver_id: "another-driver" }),
      },
    });
    const service = new DriverIncidentService(dependencies);

    await expect(service.createIncident(DRIVER_ID, buildPayload())).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN_ROLE",
    });

    expect(dependencies.incidentsRepository.createPassengerIncident).not.toHaveBeenCalled();
  });
});
