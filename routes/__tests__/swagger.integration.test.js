"use strict";

process.env.AUTH_DEV_BYPASS = "true";
process.env.SUPABASE_URL = "http://localhost";
process.env.SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

jest.mock("../../repositories/routesRepository");

const request = require("supertest");
const buildApp = require("../../app");

const app = buildApp();

describe("documentacion OpenAPI", () => {
  test("GET /api/docs.json -> 200 con spec OpenAPI 3", async () => {
    const res = await request(app).get("/api/docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toBe("Bus Tracking API - Rutas");
  });

  test("el spec documenta todos los endpoints existentes", async () => {
    const res = await request(app).get("/api/docs.json");
    const { paths } = res.body;
    expect(Object.keys(paths["/health"])).toContain("get");
    expect(Object.keys(paths["/api/admin/routes"]).sort()).toEqual(["get", "post"]);
    expect(Object.keys(paths["/api/admin/routes/{id}"]).sort()).toEqual([
      "delete",
      "put",
    ]);
    expect(Object.keys(paths["/api/passenger/routes"])).toContain("get");
  });

  test("no exige autenticacion para servir la documentacion", async () => {
    const res = await request(app).get("/api/docs.json");
    expect(res.status).toBe(200);
  });

  test("GET /api/docs/ -> 200 sirve la UI de Swagger", async () => {
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
