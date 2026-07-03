"use strict";

jest.mock("../../services/googleRoutes.service", () => ({
  computeRoute: jest.fn(),
}));

jest.mock("../../database/supabaseClient", () => ({
  verifyAccessToken: jest.fn(),
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));

const request = require("supertest");
const buildApp = require("../../app");
const googleRoutesService = require("../../services/googleRoutes.service");
const { verifyAccessToken } = require("../../database/supabaseClient");

const app = buildApp();
const AUTH_HEADER = "Bearer admin-token";
const adminUser = { id: "admin-user-id", app_metadata: { role: "Admin" } };
const passengerUser = { id: "passenger-user-id", app_metadata: { role: "Passenger" } };

describe("google routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue(adminUser);
  });

  test("POST /api/google/routes/compute returns computed route", async () => {
    googleRoutesService.computeRoute.mockResolvedValue({
      distance_meters: 97379,
      duration: "6208s",
      encoded_polyline: "encoded-polyline",
    });

    const response = await request(app)
      .post("/api/google/routes/compute")
      .set("Authorization", AUTH_HEADER)
      .send({
        origin: {
          latitude: 9.9763,
          longitude: -84.8384,
        },
        destination: {
          latitude: 9.9333,
          longitude: -84.0833,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      distance_meters: 97379,
      duration: "6208s",
      encoded_polyline: "encoded-polyline",
    });

    expect(googleRoutesService.computeRoute).toHaveBeenCalledWith({
      origin: {
        latitude: 9.9763,
        longitude: -84.8384,
      },
      destination: {
        latitude: 9.9333,
        longitude: -84.0833,
      },
    });
  });

  test("POST /api/google/routes/compute rejects invalid coordinates", async () => {
    const response = await request(app)
      .post("/api/google/routes/compute")
      .set("Authorization", AUTH_HEADER)
      .send({
        origin: {
          latitude: 100,
          longitude: -84.8384,
        },
        destination: {
          latitude: 9.9333,
          longitude: -84.0833,
        },
      });

    expect(response.status).toBe(400);
    expect(googleRoutesService.computeRoute).not.toHaveBeenCalled();
  });

  test("POST /api/google/routes/compute rejects unauthenticated requests", async () => {
    const response = await request(app)
      .post("/api/google/routes/compute")
      .send({
        origin: { latitude: 9.9763, longitude: -84.8384 },
        destination: { latitude: 9.9333, longitude: -84.0833 },
      });

    expect(response.status).toBe(401);
    expect(googleRoutesService.computeRoute).not.toHaveBeenCalled();
  });

  test("POST /api/google/routes/compute rejects non-admin roles", async () => {
    verifyAccessToken.mockResolvedValue(passengerUser);

    const response = await request(app)
      .post("/api/google/routes/compute")
      .set("Authorization", "Bearer passenger-token")
      .send({
        origin: { latitude: 9.9763, longitude: -84.8384 },
        destination: { latitude: 9.9333, longitude: -84.0833 },
      });

    expect(response.status).toBe(403);
    expect(googleRoutesService.computeRoute).not.toHaveBeenCalled();
  });
});