"use strict";

const {
  delayTripSchema,
  cancelTripSchema,
  reportDetourSchema,
} = require("../driverTrip.model");

describe("driver operational schemas", () => {
  test("allows cancellation without a request body", () => {
    expect(cancelTripSchema.parse(undefined)).toEqual({});
  });

  test("requires a bounded reason for a delay", () => {
    expect(delayTripSchema.safeParse({ reason: "Congestion", estimated_delay_minutes: 15 }).success)
      .toBe(true);
    expect(delayTripSchema.safeParse({ estimated_delay_minutes: 15 }).success).toBe(false);
  });

  test("accepts a bounded detour payload", () => {
    expect(reportDetourSchema.safeParse({
      reason: "Cierre vial",
      affected_stop_ids: ["3f2504e0-4f89-41d3-9a0c-0305e82c3301"],
      expected_end_at: "2026-08-21T20:00:00Z",
    }).success).toBe(true);
  });
});
