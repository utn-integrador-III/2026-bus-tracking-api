"use strict";

jest.mock("../../services/googleRoutes.service", () => ({
  computeRoute: jest.fn(),
}));

const request = require("supertest");
const buildApp = require("../../app");
const googleRoutesService = require("../../services/googleRoutes.service");

const app = buildApp();

describe("google routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/google/routes/compute returns computed route", async () => {
    googleRoutesService.computeRoute.mockResolvedValue({
      distance_meters: 97379,
      duration: "6208s",
      encoded_polyline: "encoded-polyline",
    });

    const response = await request(app)
      .post("/api/google/routes/compute")
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
});