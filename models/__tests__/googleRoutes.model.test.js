"use strict";

const { computeGoogleRouteSchema } = require("../googleRoutes.model");

describe("computeGoogleRouteSchema", () => {
  test("accepts a valid route calculation payload", () => {
    const result = computeGoogleRouteSchema.safeParse({
      origin: {
        latitude: 9.9763,
        longitude: -84.8384,
      },
      destination: {
        latitude: 9.9333,
        longitude: -84.0833,
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejects latitude out of range", () => {
    const result = computeGoogleRouteSchema.safeParse({
      origin: {
        latitude: 100,
        longitude: -84.8384,
      },
      destination: {
        latitude: 9.9333,
        longitude: -84.0833,
      },
    });

    expect(result.success).toBe(false);
  });

  test("rejects longitude out of range", () => {
    const result = computeGoogleRouteSchema.safeParse({
      origin: {
        latitude: 9.9763,
        longitude: -200,
      },
      destination: {
        latitude: 9.9333,
        longitude: -84.0833,
      },
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys", () => {
    const result = computeGoogleRouteSchema.safeParse({
      origin: {
        latitude: 9.9763,
        longitude: -84.8384,
      },
      destination: {
        latitude: 9.9333,
        longitude: -84.0833,
      },
      role: "Admin",
    });

    expect(result.success).toBe(false);
  });
});