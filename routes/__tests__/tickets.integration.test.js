"use strict";

jest.mock("../../middleware/requireAuth", () => {
  return (req, _res, next) => {
    req.auth = {
      userId: "15740dd7-9b7f-4838-aaf8-b59141e7edac",
    };

    next();
  };
});

const express = require("express");
const request = require("supertest");
const { createTicketsRouter } = require("../../src/modules/tickets");

const PASSENGER_ID = "15740dd7-9b7f-4838-aaf8-b59141e7edac";
const TRIP_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const TICKET_ID = "9f2504e0-4f89-41d3-9a0c-0305e82c3309";

function buildApp(ticketService) {
  const app = express();

  app.use(express.json());
  app.use("/api/tickets", createTicketsRouter({ ticketService }));

  return app;
}

describe("POST /api/tickets/checkout", () => {
  test("returns 201 and creates a generated ticket", async () => {
    const ticket = {
      id: TICKET_ID,
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      qr_payload: "secure_payload",
      created_at: "2026-07-01T00:00:00.000Z",
    };

    const ticketService = {
      checkout: jest.fn().mockResolvedValue(ticket),
    };

    const app = buildApp(ticketService);

    const res = await request(app)
      .post("/api/tickets/checkout")
      .send({
        trip_id: TRIP_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(ticket);
    expect(ticketService.checkout).toHaveBeenCalledWith(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });
  });

  test("rejects invalid checkout payload", async () => {
    const ticketService = {
      checkout: jest.fn(),
    };

    const app = buildApp(ticketService);

    const res = await request(app)
      .post("/api/tickets/checkout")
      .send({
        trip_id: "invalid-trip-id",
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(ticketService.checkout).not.toHaveBeenCalled();
  });
});