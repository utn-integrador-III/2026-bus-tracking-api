"use strict";

const request = require("supertest");
const buildApp = require("../../app");

const app = buildApp();

describe("service endpoints", () => {
  test("GET / -> 200 describes the API entry points", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: "2026 Bus Tracking API",
      status: "ok",
      health: "/health",
      documentation: "/api/docs",
    });
  });

  test("GET /health -> 200 reports a healthy service", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
