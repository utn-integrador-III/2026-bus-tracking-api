"use strict";

const { haversineDistanceMeters } = require("../distance");

describe("haversineDistanceMeters", () => {
  it("should calculate distance between two points accurately", () => {
    const lat1 = 9.9281;
    const lon1 = -84.0907;

    const lat2 = 9.8644;
    const lon2 = -83.9194;

    const distance = haversineDistanceMeters(lat1, lon1, lat2, lon2);

    expect(distance).toBeGreaterThan(19000);
    expect(distance).toBeLessThan(21000);
  });

  it("should return 0 for identical points", () => {
    const lat1 = 9.9281;
    const lon1 = -84.0907;
    expect(haversineDistanceMeters(lat1, lon1, lat1, lon1)).toBe(0);
  });
});
