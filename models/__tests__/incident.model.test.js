"use strict";

const {
  createPassengerIncidentSchema,
  listPassengerIncidentsQuerySchema,
} = require("../incident.model");

const validTripId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("createPassengerIncidentSchema", () => {
  test("accepts a valid passenger incident payload", () => {
    const result = createPassengerIncidentSchema.safeParse({
      trip_id: validTripId,
      type: "Delay",
      description: "Traffic jam near the main stop.",
      latitude: 9.9763,
      longitude: -84.8384,
    });

    expect(result.success).toBe(true);
  });

  test("accepts a payload without description", () => {
    const result = createPassengerIncidentSchema.safeParse({
      trip_id: validTripId,
      type: "Overcrowding",
      latitude: 9.9763,
      longitude: -84.8384,
    });

    expect(result.success).toBe(true);
  });

  test("rejects an invalid trip id", () => {
    const result = createPassengerIncidentSchema.safeParse({
      trip_id: "invalid-id",
      type: "Delay",
      latitude: 9.9763,
      longitude: -84.8384,
    });

    expect(result.success).toBe(false);
  });

  test("rejects latitude out of range", () => {
    const result = createPassengerIncidentSchema.safeParse({
      trip_id: validTripId,
      type: "Delay",
      latitude: 100,
      longitude: -84.8384,
    });

    expect(result.success).toBe(false);
  });

  test("rejects longitude out of range", () => {
    const result = createPassengerIncidentSchema.safeParse({
      trip_id: validTripId,
      type: "Delay",
      latitude: 9.9763,
      longitude: -200,
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys", () => {
    const result = createPassengerIncidentSchema.safeParse({
      trip_id: validTripId,
      type: "Delay",
      latitude: 9.9763,
      longitude: -84.8384,
      user_role: "Admin",
    });

    expect(result.success).toBe(false);
  });
});

describe("listPassengerIncidentsQuerySchema", () => {
  test("accepts a valid trip id query", () => {
    const result = listPassengerIncidentsQuerySchema.safeParse({
      trip_id: validTripId,
    });

    expect(result.success).toBe(true);
  });

  test("rejects a missing trip id", () => {
    const result = listPassengerIncidentsQuerySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  test("rejects an invalid trip id", () => {
    const result = listPassengerIncidentsQuerySchema.safeParse({
      trip_id: "invalid-id",
    });

    expect(result.success).toBe(false);
  });
});