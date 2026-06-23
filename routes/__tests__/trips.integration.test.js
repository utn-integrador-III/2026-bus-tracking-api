"use strict";

process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

jest.mock("../../repositories/tripsRepository");

const request = require("supertest");
const tripsRepository = require("../../repositories/tripsRepository");
const AppError = require("../../utils/AppError");
const buildApp = require("../../app");

const app = buildApp();

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const validBody = {
  route_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  bus_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  driver_id: "1f9e2c3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  departure_time: "2026-06-21T08:00:00Z",
};

const sampleRow = {
  id: UUID,
  route_id: validBody.route_id,
  bus_id: validBody.bus_id,
  driver_id: validBody.driver_id,
  departure_time: "2026-06-21T08:00:00.000Z",
  arrival_time: null,
  status: "Scheduled",
  created_at: "2026-06-20T12:00:00.000Z",
  started_at: null,
  ended_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/passenger/trips", () => {
  test("lista los viajes visibles (sin auth)", async () => {
    tripsRepository.listTrips.mockResolvedValue([sampleRow]);
    const res = await request(app).get("/api/passenger/trips");
    expect(res.status).toBe(200);
    expect(tripsRepository.listTrips).toHaveBeenCalledWith({
      statuses: expect.any(Array),
    });
    expect(res.body[0]).toHaveProperty("status", "Scheduled");
    expect(res.body[0]).not.toHaveProperty("driver_id");
  });
});

describe("GET /api/admin/trips", () => {
  test("lista la coleccion completa", async () => {
    tripsRepository.listTrips.mockResolvedValue([sampleRow]);
    const res = await request(app).get("/api/admin/trips");
    expect(res.status).toBe(200);
    expect(tripsRepository.listTrips).toHaveBeenCalledWith({});
    expect(res.body[0]).toHaveProperty("driver_id", validBody.driver_id);
  });
});

describe("GET /api/admin/trips/:id", () => {
  test("viaje existente -> 200 forma admin", async () => {
    tripsRepository.getTripById.mockResolvedValue(sampleRow);
    const res = await request(app).get(`/api/admin/trips/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", UUID);
  });

  test("viaje inexistente -> 404", async () => {
    tripsRepository.getTripById.mockResolvedValue(null);
    const res = await request(app).get(`/api/admin/trips/${UUID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TRIP_NOT_FOUND");
  });

  test("id no UUID -> 400", async () => {
    const res = await request(app).get("/api/admin/trips/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TRIP_VALIDATION_FAILED");
  });
});

describe("POST /api/admin/trips", () => {
  test("crea -> 201 { id }", async () => {
    tripsRepository.createTrip.mockResolvedValue(sampleRow);
    const res = await request(app).post("/api/admin/trips").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: UUID });
  });

  test("departure_time invalido -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/trips")
      .send({ ...validBody, departure_time: "manana" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TRIP_VALIDATION_FAILED");
  });

  test("clave desconocida en el body -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/trips")
      .send({ ...validBody, role: "Admin" });
    expect(res.status).toBe(400);
  });

  test("FK inexistente -> 409 TRIP_REFERENCE_INVALID", async () => {
    tripsRepository.createTrip.mockRejectedValue(
      new AppError(409, "TRIP_REFERENCE_INVALID", "FK invalida."),
    );
    const res = await request(app).post("/api/admin/trips").send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TRIP_REFERENCE_INVALID");
  });
});

describe("PUT /api/admin/trips/:id", () => {
  test("viaje existente -> 200 { updated: true }", async () => {
    tripsRepository.getTripById.mockResolvedValue(sampleRow);
    tripsRepository.updateTrip.mockResolvedValue(sampleRow);
    const res = await request(app)
      .put(`/api/admin/trips/${UUID}`)
      .send({ status: "Delayed" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: true });
  });

  test("viaje inexistente -> 404", async () => {
    tripsRepository.getTripById.mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/admin/trips/${UUID}`)
      .send({ status: "Delayed" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TRIP_NOT_FOUND");
  });

  test("body vacio -> 400", async () => {
    const res = await request(app).put(`/api/admin/trips/${UUID}`).send({});
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/trips/:id", () => {
  test("cancela -> 200 { deleted: true }", async () => {
    tripsRepository.getTripById.mockResolvedValue(sampleRow);
    tripsRepository.setTripStatus.mockResolvedValue({ ...sampleRow, status: "Cancelled" });
    const res = await request(app).delete(`/api/admin/trips/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(tripsRepository.setTripStatus).toHaveBeenCalledWith(UUID, "Cancelled");
  });

  test("viaje inexistente -> 404", async () => {
    tripsRepository.getTripById.mockResolvedValue(null);
    const res = await request(app).delete(`/api/admin/trips/${UUID}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/trips/:id/reactivate", () => {
  test("reactiva -> 200 { reactivated: true }", async () => {
    tripsRepository.getTripById.mockResolvedValue({ ...sampleRow, status: "Cancelled" });
    tripsRepository.setTripStatus.mockResolvedValue({ ...sampleRow, status: "Scheduled" });
    const res = await request(app).post(`/api/admin/trips/${UUID}/reactivate`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reactivated: true });
    expect(tripsRepository.setTripStatus).toHaveBeenCalledWith(UUID, "Scheduled");
  });

  test("viaje inexistente -> 404", async () => {
    tripsRepository.getTripById.mockResolvedValue(null);
    const res = await request(app).post(`/api/admin/trips/${UUID}/reactivate`);
    expect(res.status).toBe(404);
    expect(tripsRepository.setTripStatus).not.toHaveBeenCalled();
  });
});
