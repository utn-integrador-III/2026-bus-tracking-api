"use strict";

process.env.AUTH_DEV_BYPASS = "true";
process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

jest.mock("../../repositories/routesRepository");

const request = require("supertest");
const routesRepository = require("../../repositories/routesRepository");
const buildApp = require("../../app");

const app = buildApp();

const ADMIN = { "x-dev-user-id": "dev-admin", "x-dev-role": "Admin" };
const PASSENGER = { "x-dev-user-id": "dev-pax", "x-dev-role": "Passenger" };
const DRIVER = { "x-dev-user-id": "dev-drv", "x-dev-role": "Driver" };

const validBody = {
  name: "SJ-PT",
  origin: "San Jose",
  destination: "Puntarenas",
  geometry_geojson: {
    type: "LineString",
    coordinates: [
      [-84.07, 9.93],
      [-84.75, 9.98],
    ],
  },
};

const sampleRow = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  name: "SJ-PT",
  origin: "San Jose",
  destination: "Puntarenas",
  geometry_geojson: validBody.geometry_geojson,
  is_active: true,
  created_at: "2026-06-20T12:00:00.000Z",
};

const UUID = sampleRow.id;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("health", () => {
  test("GET /health -> 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("autenticacion", () => {
  test("sin cabeceras dev -> 401", async () => {
    const res = await request(app).get("/api/passenger/routes");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_TOKEN_MISSING");
  });

  test("rol invalido -> 401", async () => {
    const res = await request(app)
      .get("/api/passenger/routes")
      .set({ "x-dev-user-id": "x", "x-dev-role": "Hacker" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/passenger/routes", () => {
  test("Passenger ve solo rutas activas", async () => {
    routesRepository.listRoutes.mockResolvedValue([sampleRow]);
    const res = await request(app).get("/api/passenger/routes").set(PASSENGER);
    expect(res.status).toBe(200);
    expect(routesRepository.listRoutes).toHaveBeenCalledWith({ includeInactive: false });
    expect(res.body[0]).toHaveProperty("status", "Active");
    expect(res.body[0]).not.toHaveProperty("is_active");
  });

  test("Driver tambien puede consultar", async () => {
    routesRepository.listRoutes.mockResolvedValue([]);
    const res = await request(app).get("/api/passenger/routes").set(DRIVER);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/admin/routes", () => {
  test("Admin ve la lista completa", async () => {
    routesRepository.listRoutes.mockResolvedValue([sampleRow]);
    const res = await request(app).get("/api/admin/routes").set(ADMIN);
    expect(res.status).toBe(200);
    expect(routesRepository.listRoutes).toHaveBeenCalledWith({ includeInactive: true });
    expect(res.body[0]).toHaveProperty("is_active", true);
  });

  test("Passenger recibe 403", async () => {
    const res = await request(app).get("/api/admin/routes").set(PASSENGER);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });
});

describe("POST /api/admin/routes", () => {
  test("Admin crea -> 201 { id }", async () => {
    routesRepository.createRoute.mockResolvedValue(sampleRow);
    const res = await request(app).post("/api/admin/routes").set(ADMIN).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: UUID });
  });

  test("geometria invalida -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/routes")
      .set(ADMIN)
      .send({ ...validBody, geometry_geojson: { type: "LineString", coordinates: [[-84, 9]] } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ROUTE_VALIDATION_FAILED");
  });

  test("clave desconocida en el body -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/routes")
      .set(ADMIN)
      .send({ ...validBody, role: "Admin" });
    expect(res.status).toBe(400);
  });

  test("Passenger no puede crear -> 403", async () => {
    const res = await request(app).post("/api/admin/routes").set(PASSENGER).send(validBody);
    expect(res.status).toBe(403);
    expect(routesRepository.createRoute).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/routes/:id", () => {
  test("id no UUID -> 400", async () => {
    const res = await request(app)
      .put("/api/admin/routes/not-a-uuid")
      .set(ADMIN)
      .send({ name: "Nuevo" });
    expect(res.status).toBe(400);
  });

  test("Admin edita ruta existente -> 200 { updated: true }", async () => {
    routesRepository.getRouteById.mockResolvedValue(sampleRow);
    routesRepository.updateRoute.mockResolvedValue(sampleRow);
    const res = await request(app)
      .put(`/api/admin/routes/${UUID}`)
      .set(ADMIN)
      .send({ name: "Nuevo" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: true });
  });

  test("ruta inexistente -> 404", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/admin/routes/${UUID}`)
      .set(ADMIN)
      .send({ name: "Nuevo" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

describe("DELETE /api/admin/routes/:id", () => {
  test("Admin desactiva -> 200 { deleted: true }", async () => {
    routesRepository.getRouteById.mockResolvedValue(sampleRow);
    routesRepository.setRouteActive.mockResolvedValue({ ...sampleRow, is_active: false });
    const res = await request(app).delete(`/api/admin/routes/${UUID}`).set(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(routesRepository.setRouteActive).toHaveBeenCalledWith(UUID, false);
  });

  test("id no UUID -> 400", async () => {
    const res = await request(app).delete("/api/admin/routes/xxx").set(ADMIN);
    expect(res.status).toBe(400);
  });

  test("ruta inexistente -> 404", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    const res = await request(app).delete(`/api/admin/routes/${UUID}`).set(ADMIN);
    expect(res.status).toBe(404);
  });
});

describe("rutas no resueltas", () => {
  test("GET inexistente -> 404 NOT_FOUND", async () => {
    const res = await request(app).get("/api/unknown").set(ADMIN);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
