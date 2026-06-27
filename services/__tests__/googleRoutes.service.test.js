"use strict";

jest.mock("../../config/env", () => ({
  env: {
    googleMapsApiKey: "test-google-key",
    googleRoutesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes",
  },
  assertGoogleMapsConfig: jest.fn(),
}));

const googleRoutesService = require("../googleRoutes.service");
const { ERROR_CODES } = require("../../constants/errorCodes");

const payload = {
  origin: {
    latitude: 9.9763,
    longitude: -84.8384,
  },
  destination: {
    latitude: 9.9333,
    longitude: -84.0833,
  },
};

describe("googleRoutes.service", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
  });

  test("builds Google Routes API body", () => {
    const body = googleRoutesService.buildGoogleRoutesBody(payload);

    expect(body).toEqual({
      origin: {
        location: {
          latLng: {
            latitude: 9.9763,
            longitude: -84.8384,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: 9.9333,
            longitude: -84.0833,
          },
        },
      },
      travelMode: "DRIVE",
    });
  });

  test("formats Google Routes API response", () => {
    const result = googleRoutesService.presentGoogleRoute({
      routes: [
        {
          distanceMeters: 97379,
          duration: "6208s",
          polyline: {
            encodedPolyline: "encoded-polyline",
          },
        },
      ],
    });

    expect(result).toEqual({
      distance_meters: 97379,
      duration: "6208s",
      encoded_polyline: "encoded-polyline",
    });
  });

  test("computes a route successfully", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        routes: [
          {
            distanceMeters: 97379,
            duration: "6208s",
            polyline: {
              encodedPolyline: "encoded-polyline",
            },
          },
        ],
      }),
    });

    const result = await googleRoutesService.computeRoute(payload);

    expect(global.fetch).toHaveBeenCalled();
    expect(result.distance_meters).toBe(97379);
    expect(result.duration).toBe("6208s");
    expect(result.encoded_polyline).toBe("encoded-polyline");
  });

  test("throws error when Google Routes API fails", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: {
          message: "Invalid API key",
        },
      }),
    });

    await expect(googleRoutesService.computeRoute(payload)).rejects.toMatchObject({
      code: ERROR_CODES.GOOGLE_ROUTES_ERROR,
    });
  });

  test("throws error when no route is returned", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        routes: [],
      }),
    });

    await expect(googleRoutesService.computeRoute(payload)).rejects.toMatchObject({
      code: ERROR_CODES.GOOGLE_ROUTE_NOT_FOUND,
    });
  });
});