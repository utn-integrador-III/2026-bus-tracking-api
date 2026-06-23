"use strict";

process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

jest.mock("../../repositories/routesRepository");

const request = require("supertest");
const routesRepository = require("../../repositories/routesRepository");
const buildApp = require("../../app");

const app = buildApp();

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

describe("GET /api/passenger/routes", () => {
  test("lista solo rutas activas (sin auth)", async () => {
    routesRepository.listRoutes.mockResolvedValue([sampleRow]);
    const res = await request(app).get("/api/passenger/routes");
    expect(res.status).toBe(200);
    expect(routesRepository.listRoutes).toHaveBeenCalledWith({ includeInactive: false });
    expect(res.body[0]).toHaveProperty("status", "Active");
    expect(res.body[0]).not.toHaveProperty("is_active");
  });
});

describe("GET /api/admin/routes", () => {
  test("lista la coleccion completa (incluye inactivas)", async () => {
    routesRepository.listRoutes.mockResolvedValue([sampleRow]);
    const res = await request(app).get("/api/admin/routes");
    expect(res.status).toBe(200);
    expect(routesRepository.listRoutes).toHaveBeenCalledWith({ includeInactive: true });
    expect(res.body[0]).toHaveProperty("is_active", true);
  });
});

describe("GET /api/admin/routes/:id", () => {
  test("ruta existente -> 200 forma admin", async () => {
    routesRepository.getRouteById.mockResolvedValue(sampleRow);
    const res = await request(app).get(`/api/admin/routes/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", UUID);
    expect(res.body).toHaveProperty("is_active", true);
  });

  test("ruta inexistente -> 404", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    const res = await request(app).get(`/api/admin/routes/${UUID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  test("id no UUID -> 400", async () => {
    const res = await request(app).get("/api/admin/routes/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ROUTE_VALIDATION_FAILED");
  });
});

describe("POST /api/admin/routes", () => {
  test("crea -> 201 { id }", async () => {
    routesRepository.createRoute.mockResolvedValue(sampleRow);
    const res = await request(app).post("/api/admin/routes").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: UUID });
  });

  test("geometria invalida -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/routes")
      .send({ ...validBody, geometry_geojson: { type: "LineString", coordinates: [[-84, 9]] } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ROUTE_VALIDATION_FAILED");
  });

  test("clave desconocida en el body -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/routes")
      .send({ ...validBody, role: "Admin" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/admin/routes/:id", () => {
  test("id no UUID -> 400", async () => {
    const res = await request(app).put("/api/admin/routes/not-a-uuid").send({ name: "Nuevo" });
    expect(res.status).toBe(400);
  });

  test("ruta existente -> 200 { updated: true }", async () => {
    routesRepository.getRouteById.mockResolvedValue(sampleRow);
    routesRepository.updateRoute.mockResolvedValue(sampleRow);
    const res = await request(app).put(`/api/admin/routes/${UUID}`).send({ name: "Nuevo" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: true });
  });

  test("ruta inexistente -> 404", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    const res = await request(app).put(`/api/admin/routes/${UUID}`).send({ name: "Nuevo" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

describe("DELETE /api/admin/routes/:id", () => {
  test("desactiva -> 200 { deleted: true }", async () => {
    routesRepository.getRouteById.mockResolvedValue(sampleRow);
    routesRepository.setRouteActive.mockResolvedValue({ ...sampleRow, is_active: false });
    const res = await request(app).delete(`/api/admin/routes/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(routesRepository.setRouteActive).toHaveBeenCalledWith(UUID, false);
  });

  test("id no UUID -> 400", async () => {
    const res = await request(app).delete("/api/admin/routes/xxx");
    expect(res.status).toBe(400);
  });

  test("ruta inexistente -> 404", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    const res = await request(app).delete(`/api/admin/routes/${UUID}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/routes/:id/reactivate", () => {
  test("reactiva -> 200 { reactivated: true }", async () => {
    routesRepository.getRouteById.mockResolvedValue({ ...sampleRow, is_active: false });
    routesRepository.setRouteActive.mockResolvedValue({ ...sampleRow, is_active: true });
    const res = await request(app).post(`/api/admin/routes/${UUID}/reactivate`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reactivated: true });
    expect(routesRepository.setRouteActive).toHaveBeenCalledWith(UUID, true);
  });

  test("ruta inexistente -> 404", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    const res = await request(app).post(`/api/admin/routes/${UUID}/reactivate`);
    expect(res.status).toBe(404);
    expect(routesRepository.setRouteActive).not.toHaveBeenCalled();
  });

  test("id no UUID -> 400", async () => {
    const res = await request(app).post("/api/admin/routes/xxx/reactivate");
    expect(res.status).toBe(400);
  });
});

describe("rutas no resueltas", () => {
  test("GET inexistente -> 404 NOT_FOUND", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
