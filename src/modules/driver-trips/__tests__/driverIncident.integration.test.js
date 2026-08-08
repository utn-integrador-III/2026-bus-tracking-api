"use strict";

jest.mock("../../../../database/supabaseClient", () => ({
  verifyAccessToken: jest.fn(),
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));
jest.mock("../../../../repositories/tripsRepository", () => ({
  getTripById: jest.fn(),
  listTrips: jest.fn(),
  createTrip: jest.fn(),
  updateTrip: jest.fn(),
  setTripStatus: jest.fn(),
  findTripsByDriverId: jest.fn(),
}));
jest.mock("../../../../repositories/locationRepository", () => ({
  createLocation: jest.fn(),
  batchInsertLocations: jest.fn(),
  getLatestByTripId: jest.fn(),
}));
jest.mock("../../../../repositories/incidentsRepository", () => ({
  createPassengerIncident: jest.fn(),
  findIncidentsByTripId: jest.fn(),
}));

const request = require("supertest");
const { verifyAccessToken } = require("../../../../database/supabaseClient");
const tripsRepository = require("../../../../repositories/tripsRepository");
const locationRepository = require("../../../../repositories/locationRepository");
const incidentsRepository = require("../../../../repositories/incidentsRepository");
const buildApp = require("../../../../app");

const app = buildApp();
const AUTH_TOKEN = "test-token";
const DRIVER_ID = "driver-user-id";
const TRIP_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const driverUser = { id: DRIVER_ID, user_metadata: { role: "Driver" } };
const passengerUser = { id: "passenger-user-id", user_metadata: { role: "Passenger" } };

function validBody(overrides = {}) {
  return {
    trip_id: TRIP_ID,
    type: "mechanical_failure",
    description: "Engine warning light",
    latitude: 9.9763,
    longitude: -84.8384,
    ...overrides,
  };
}

describe("POST /api/driver/incidents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue(driverUser);
    tripsRepository.getTripById.mockResolvedValue({ id: TRIP_ID, driver_id: DRIVER_ID });
    locationRepository.getLatestByTripId.mockResolvedValue({ speed: 0 });
    incidentsRepository.createPassengerIncident.mockResolvedValue({ id: "incident-1" });
  });

  test("creates the incident when the vehicle is stopped", async () => {
    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send(validBody());

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "incident-1" });
  });

  test("rejects with 409 when the last telemetry reports movement", async () => {
    locationRepository.getLatestByTripId.mockResolvedValue({ speed: 15 });

    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send(validBody());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DRIVER_INCIDENT_SPEED_LOCKED");
    expect(incidentsRepository.createPassengerIncident).not.toHaveBeenCalled();
  });

  test("rejects with 409 when the request itself reports movement", async () => {
    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send(validBody({ speed: 20 }));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DRIVER_INCIDENT_SPEED_LOCKED");
  });

  test("rejects a passenger token with 403", async () => {
    verifyAccessToken.mockResolvedValue(passengerUser);

    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send(validBody());

    expect(response.status).toBe(403);
  });

  test("requires authentication", async () => {
    const response = await request(app).post("/api/driver/incidents").send(validBody());

    expect(response.status).toBe(401);
  });

  test("rejects an invalid body", async () => {
    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send({ trip_id: "not-a-uuid", type: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DRIVER_INCIDENT_VALIDATION_FAILED");
  });

  test("rejects an incident type outside the report_type enum", async () => {
    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send(validBody({ type: "banana" }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DRIVER_INCIDENT_VALIDATION_FAILED");
  });

  test("rejects a missing description", async () => {
    const { description: _description, ...bodyWithoutDescription } = validBody();

    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send(bodyWithoutDescription);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DRIVER_INCIDENT_VALIDATION_FAILED");
  });

  test("normalizes the incident type casing to the enum value", async () => {
    const response = await request(app)
      .post("/api/driver/incidents")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send(validBody({ type: "  mechanical_failure  " }));

    expect(response.status).toBe(201);
    expect(incidentsRepository.createPassengerIncident).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Mechanical_Failure" }),
    );
  });
});
