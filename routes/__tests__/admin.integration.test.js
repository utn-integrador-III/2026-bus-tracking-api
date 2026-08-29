"use strict";

jest.mock("../../database/supabaseClient", () => ({
  verifyAccessToken: jest.fn(),
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));
jest.mock("../../src/modules/admin/infrastructure/SupabaseAdminRepository");

const request = require("supertest");
const { verifyAccessToken } = require("../../database/supabaseClient");
const SupabaseAdminRepository = require("../../src/modules/admin/infrastructure/SupabaseAdminRepository");
const buildApp = require("../../app");

const app = buildApp();
const AUTH_TOKEN = "test-token";
const ADMIN_ID = "admin-user-id";
const TRIP_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ROUTE_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";
const adminUser = { id: ADMIN_ID, user_metadata: { role: "Admin" } };
const passengerUser = { id: "passenger-user-id", user_metadata: { role: "Passenger" } };

function mockRepository() {
  const prototype = SupabaseAdminRepository.prototype;
  prototype.listBuses.mockResolvedValue([
    { id: "bus-1", plate_number: "ABC-123", capacity: 40, status: "active", created_at: "2026-06-01T00:00:00Z" },
  ]);
  prototype.listStops.mockResolvedValue([
    {
      id: "stop-1",
      route_id: ROUTE_ID,
      name: "Parada Central",
      latitude: 9.9763,
      longitude: -84.8384,
      stop_order: 1,
      geofence_radius_meters: 500,
    },
  ]);
  prototype.createStop.mockResolvedValue({ id: "stop-2" });
  prototype.getStopById.mockResolvedValue({
    id: "stop-1",
    route_id: ROUTE_ID,
    name: "Parada Central",
    latitude: 9.9763,
    longitude: -84.8384,
    stop_order: 1,
    geofence_radius_meters: 500,
  });
  prototype.updateStop.mockResolvedValue({
    id: "stop-1",
    route_id: ROUTE_ID,
    name: "Parada Central",
    latitude: 9.9763,
    longitude: -84.8384,
    stop_order: 1,
    geofence_radius_meters: 500,
  });
  prototype.deleteStop.mockResolvedValue({ id: "stop-1" });
  prototype.listIncidents.mockResolvedValue([
    {
      id: "incident-1",
      trip_id: TRIP_ID,
      user_id: "user-1",
      type: "Traffic_Congestion",
      description: "Traffic jam near the main stop.",
      latitude: 9.9763,
      longitude: -84.8384,
      timestamp: "2026-06-20T10:00:00Z",
      moderation_status: "pending",
    },
  ]);
  prototype.getIncidentById.mockResolvedValue({
    id: "incident-1",
    trip_id: TRIP_ID,
    user_id: "user-1",
    type: "Traffic_Congestion",
    description: "Traffic jam near the main stop.",
    latitude: 9.9763,
    longitude: -84.8384,
    timestamp: "2026-06-20T10:00:00Z",
    moderation_status: "pending",
  });
  prototype.setIncidentModeration.mockResolvedValue({
    id: "incident-1",
    trip_id: TRIP_ID,
    user_id: "user-1",
    type: "Traffic_Congestion",
    description: "Traffic jam near the main stop.",
    latitude: 9.9763,
    longitude: -84.8384,
    timestamp: "2026-06-20T10:00:00Z",
    moderation_status: "validated",
  });
  prototype.getTelemetryHistory.mockResolvedValue([
    {
      id: "loc-1",
      trip_id: TRIP_ID,
      latitude: 9.9763,
      longitude: -84.8384,
      speed: 25,
      heading: 90,
      recorded_at: "2026-06-20T10:00:00Z",
    },
  ]);
  prototype.getCurrentTelemetry.mockResolvedValue([
    {
      id: "loc-2",
      trip_id: TRIP_ID,
      route_id: ROUTE_ID,
      latitude: 9.9763,
      longitude: -84.8384,
      speed: 25,
      heading: 90,
      status: "In Progress",
      recorded_at: "2026-06-20T10:00:00Z",
    },
  ]);
  prototype.listUsers.mockResolvedValue([
    { id: "user-1", name: "Ana", email: "ana@test.com", role: "Passenger", is_active: true, created_at: "2026-06-01T00:00:00Z" },
  ]);
}

describe("admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue(adminUser);
    mockRepository();
  });

  describe("GET /api/admin/buses", () => {
    test("returns 200 with the buses list", async () => {
      const response = await request(app)
        .get("/api/admin/buses")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: "bus-1", plate_number: "ABC-123", capacity: 40, status: "active", created_at: "2026-06-01T00:00:00Z" },
      ]);
    });

    test("rejects a passenger token with 403", async () => {
      verifyAccessToken.mockResolvedValue(passengerUser);

      const response = await request(app)
        .get("/api/admin/buses")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(403);
    });
  });

describe("GET /api/admin/stops", () => {
    test("returns 200 with stops, optionally filtered by route", async () => {
      const response = await request(app)
        .get(`/api/admin/stops?route_id=${ROUTE_ID}`)
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: "stop-1",
          route_id: ROUTE_ID,
          name: "Parada Central",
          latitude: 9.9763,
          longitude: -84.8384,
          stop_order: 1,
          geofence_radius_meters: 500,
        },
      ]);
      expect(SupabaseAdminRepository.prototype.listStops).toHaveBeenCalledWith(ROUTE_ID);
    });

    test("rejects an invalid route_id", async () => {
      const response = await request(app)
        .get("/api/admin/stops?route_id=not-a-uuid")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/admin/stops", () => {
    test("returns 201 when a stop is created", async () => {
      const response = await request(app)
        .post("/api/admin/stops")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({
          route_id: ROUTE_ID,
          name: "Parada Norte",
          latitude: 9.99,
          longitude: -84.1,
          stop_order: 2,
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: "stop-2" });
    });

    test("rejects a stop without name", async () => {
      const response = await request(app)
        .post("/api/admin/stops")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({
          route_id: ROUTE_ID,
          latitude: 9.99,
          longitude: -84.1,
          stop_order: 2,
        });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/admin/stops/:id", () => {
    test("returns 200 when the stop exists", async () => {
      const response = await request(app)
        .delete("/api/admin/stops/3f2504e0-4f89-41d3-9a0c-0305e82c3399")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ deleted: true });
    });

    test("returns 404 when the stop does not exist", async () => {
      SupabaseAdminRepository.prototype.deleteStop.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/admin/stops/3f2504e0-4f89-41d3-9a0c-0305e82c3399")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/admin/incidents", () => {
    test("returns 200 with incidents, optionally filtered by status", async () => {
      const response = await request(app)
        .get("/api/admin/incidents?status=Pending")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: "incident-1",
          trip_id: TRIP_ID,
          user_id: "user-1",
          type: "Traffic_Congestion",
          description: "Traffic jam near the main stop.",
          latitude: 9.9763,
          longitude: -84.8384,
          timestamp: "2026-06-20T10:00:00Z",
          status: "Pending",
        },
      ]);
      expect(SupabaseAdminRepository.prototype.listIncidents).toHaveBeenCalledWith(
        "pending",
      );
    });

    test("rejects an invalid status", async () => {
      const response = await request(app)
        .get("/api/admin/incidents?status=Unknown")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/admin/incidents/:id", () => {
    test("validates an incident as an admin", async () => {
      const response = await request(app)
        .put("/api/admin/incidents/3f2504e0-4f89-41d3-9a0c-0305e82c3301")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({ status: "Validated" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("Validated");
      expect(SupabaseAdminRepository.prototype.setIncidentModeration).toHaveBeenCalledWith(
        "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        "validated",
        ADMIN_ID,
      );
    });

    test("archives an incident as an admin", async () => {
      SupabaseAdminRepository.prototype.setIncidentModeration.mockResolvedValue({
        id: "incident-1",
        trip_id: TRIP_ID,
        user_id: "user-1",
        type: "Traffic_Congestion",
        description: "Traffic jam near the main stop.",
        latitude: 9.9763,
        longitude: -84.8384,
        timestamp: "2026-06-20T10:00:00Z",
        moderation_status: "archived",
      });

      const response = await request(app)
        .put("/api/admin/incidents/3f2504e0-4f89-41d3-9a0c-0305e82c3301")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({ status: "Archived" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("Archived");
      expect(SupabaseAdminRepository.prototype.setIncidentModeration).toHaveBeenCalledWith(
        "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        "archived",
        ADMIN_ID,
      );
    });

    test("returns 404 when the incident does not exist", async () => {
      SupabaseAdminRepository.prototype.getIncidentById.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/admin/incidents/3f2504e0-4f89-41d3-9a0c-0305e82c3301")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({ status: "Dismissed" });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/admin/telemetry/history", () => {
    test("returns 200 with the trip telemetry history", async () => {
      const response = await request(app)
        .get(`/api/admin/telemetry/history?trip_id=${TRIP_ID}`)
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: "loc-1",
          trip_id: TRIP_ID,
          latitude: 9.9763,
          longitude: -84.8384,
          speed: 25,
          heading: 90,
          timestamp: "2026-06-20T10:00:00Z",
        },
      ]);
    });

    test("rejects a missing trip_id", async () => {
      const response = await request(app)
        .get("/api/admin/telemetry/history")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/admin/telemetry/current", () => {
    test("returns 200 with the current telemetry of active trips", async () => {
      const response = await request(app)
        .get("/api/admin/telemetry/current")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          trip_id: TRIP_ID,
          route_id: ROUTE_ID,
          status: "In Progress",
          latitude: 9.9763,
          longitude: -84.8384,
          speed: 25,
          heading: 90,
          timestamp: "2026-06-20T10:00:00Z",
        },
      ]);
      expect(SupabaseAdminRepository.prototype.getCurrentTelemetry).toHaveBeenCalled();
    });
  });

  describe("PUT /api/admin/stops/:id", () => {
    test("returns 200 with the updated stop", async () => {
      const response = await request(app)
        .put("/api/admin/stops/3f2504e0-4f89-41d3-9a0c-0305e82c3301")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({ name: "Parada Central Norte" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: "stop-1",
        route_id: ROUTE_ID,
        name: "Parada Central",
        latitude: 9.9763,
        longitude: -84.8384,
        stop_order: 1,
        geofence_radius_meters: 500,
      });
      expect(SupabaseAdminRepository.prototype.updateStop).toHaveBeenCalledWith(
        "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        { name: "Parada Central Norte" },
      );
    });

    test("returns 404 when the stop does not exist", async () => {
      SupabaseAdminRepository.prototype.getStopById.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/admin/stops/3f2504e0-4f89-41d3-9a0c-0305e82c3301")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({ name: "Parada Central Norte" });

      expect(response.status).toBe(404);
      expect(SupabaseAdminRepository.prototype.updateStop).not.toHaveBeenCalled();
    });

    test("rejects an empty body", async () => {
      const response = await request(app)
        .put("/api/admin/stops/3f2504e0-4f89-41d3-9a0c-0305e82c3301")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/admin/users", () => {
    test("returns 200 with users, optionally filtered by role", async () => {
      const response = await request(app)
        .get("/api/admin/users?role=Passenger")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: "user-1", name: "Ana", email: "ana@test.com", role: "Passenger", is_active: true, created_at: "2026-06-01T00:00:00Z" },
      ]);
    });

    test("rejects an invalid role filter", async () => {
      const response = await request(app)
        .get("/api/admin/users?role=SuperUser")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(400);
    });
  });
});

describe("GET /api/passenger/stops", () => {
  test("returns only the stops for the requested route", async () => {
    verifyAccessToken.mockResolvedValue(passengerUser);

    const response = await request(app)
      .get(`/api/passenger/stops?route_id=${ROUTE_ID}`)
      .set("Authorization", `Bearer ${AUTH_TOKEN}`);

    expect(response.status).toBe(200);
    expect(SupabaseAdminRepository.prototype.listStops).toHaveBeenCalledWith(
      ROUTE_ID,
    );
    expect(response.body).toEqual([
      expect.objectContaining({ route_id: ROUTE_ID, name: "Parada Central" }),
    ]);
  });

  test("requires a valid route and passenger role", async () => {
    verifyAccessToken.mockResolvedValue(passengerUser);
    const invalid = await request(app)
      .get("/api/passenger/stops")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`);
    expect(invalid.status).toBe(400);

    verifyAccessToken.mockResolvedValue(adminUser);
    const forbidden = await request(app)
      .get(`/api/passenger/stops?route_id=${ROUTE_ID}`)
      .set("Authorization", `Bearer ${AUTH_TOKEN}`);
    expect(forbidden.status).toBe(403);
  });
});
