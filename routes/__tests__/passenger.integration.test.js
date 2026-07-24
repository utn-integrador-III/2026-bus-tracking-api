"use strict";

jest.mock("../../database/supabaseClient", () => ({
  verifyAccessToken: jest.fn(),
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));
jest.mock("../../services/passenger.service", () => ({
  createPassengerIncident: jest.fn(),
  listPassengerIncidents: jest.fn(),
}));

const request = require("supertest");
const { verifyAccessToken } = require("../../database/supabaseClient");
const buildApp = require("../../app");
const passengerService = require("../../services/passenger.service");

const app = buildApp();
const validTripId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const AUTH_TOKEN = "test-token";
const passengerUser = {
  id: "passenger-user-id",
  user_metadata: { role: "Passenger" },
};

describe("passenger incident routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue(passengerUser);
  });

  describe("POST /api/passenger/incidents", () => {
    test("returns 201 when passenger incident is created", async () => {
      passengerService.createPassengerIncident.mockResolvedValue({
        id: "incident-1",
        trip_id: validTripId,
        type: "traffic",
        description: "Traffic jam near the main stop.",
        latitude: 9.9763,
        longitude: -84.8384,
        timestamp: "2026-06-20T10:00:00Z",
      });

      const response = await request(app)
        .post("/api/passenger/incidents")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({
          trip_id: validTripId,
          type: "traffic",
          description: "Traffic jam near the main stop.",
          latitude: 9.9763,
          longitude: -84.8384,
        });

      console.log("500 ERROR BODY:", response.body);
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        incident_id: "incident-1",
        incident: {
          id: "incident-1",
          trip_id: validTripId,
          type: "traffic",
          description: "Traffic jam near the main stop.",
          latitude: 9.9763,
          longitude: -84.8384,
          timestamp: "2026-06-20T10:00:00Z",
        },
      });

      expect(passengerService.createPassengerIncident).toHaveBeenCalledWith({
        trip_id: validTripId,
        user_id: "passenger-user-id",
        type: "traffic",
        description: "Traffic jam near the main stop.",
        latitude: 9.9763,
        longitude: -84.8384,
      });
    });

    test("returns 400 when incident payload has invalid trip id", async () => {
      const response = await request(app)
        .post("/api/passenger/incidents")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({
          trip_id: "invalid-id",
          type: "traffic",
          description: "Traffic jam near the main stop.",
          latitude: 9.9763,
          longitude: -84.8384,
        });

      expect(response.status).toBe(400);
      expect(passengerService.createPassengerIncident).not.toHaveBeenCalled();
    });

    test("returns 400 when latitude is out of range", async () => {
      const response = await request(app)
        .post("/api/passenger/incidents")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({
          trip_id: validTripId,
          type: "traffic",
          latitude: 100,
          longitude: -84.8384,
        });

      expect(response.status).toBe(400);
      expect(passengerService.createPassengerIncident).not.toHaveBeenCalled();
    });

    test("returns 400 when payload has unknown keys", async () => {
      const response = await request(app)
        .post("/api/passenger/incidents")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .send({
          trip_id: validTripId,
          type: "traffic",
          latitude: 9.9763,
          longitude: -84.8384,
          role: "Admin",
        });

      expect(response.status).toBe(400);
      expect(passengerService.createPassengerIncident).not.toHaveBeenCalled();
    });

    test("returns 401 when Authorization is missing", async () => {
      const response = await request(app).post("/api/passenger/incidents").send({
        trip_id: validTripId,
        type: "traffic",
        latitude: 9.9763,
        longitude: -84.8384,
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_TOKEN_MISSING");
      expect(passengerService.createPassengerIncident).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/passenger/incidents", () => {
    test("returns 200 with incidents by trip id", async () => {
      passengerService.listPassengerIncidents.mockResolvedValue([
        {
          id: "incident-1",
          trip_id: validTripId,
          type: "traffic",
          description: "Traffic jam near the main stop.",
          latitude: 9.9763,
          longitude: -84.8384,
          timestamp: "2026-06-20T10:00:00Z",
        },
      ]);

      const response = await request(app)
        .get("/api/passenger/incidents")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .query({
          trip_id: validTripId,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: "incident-1",
          trip_id: validTripId,
          type: "traffic",
          description: "Traffic jam near the main stop.",
          latitude: 9.9763,
          longitude: -84.8384,
          timestamp: "2026-06-20T10:00:00Z",
        },
      ]);

      expect(passengerService.listPassengerIncidents).toHaveBeenCalledWith({
        trip_id: validTripId,
      });
    });

    test("returns 400 when trip id is missing", async () => {
      const response = await request(app)
        .get("/api/passenger/incidents")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(400);
      expect(passengerService.listPassengerIncidents).not.toHaveBeenCalled();
    });

    test("returns 400 when trip id is invalid", async () => {
      const response = await request(app)
        .get("/api/passenger/incidents")
        .set("Authorization", `Bearer ${AUTH_TOKEN}`)
        .query({
          trip_id: "invalid-id",
        });

      expect(response.status).toBe(400);
      expect(passengerService.listPassengerIncidents).not.toHaveBeenCalled();
    });

    test("returns 401 when Authorization is missing", async () => {
      const response = await request(app)
        .get("/api/passenger/incidents")
        .query({ trip_id: validTripId });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_TOKEN_MISSING");
      expect(passengerService.listPassengerIncidents).not.toHaveBeenCalled();
    });
  });
});