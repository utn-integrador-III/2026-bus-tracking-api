"use strict";

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
    expect(res.body.info.title).toBe("Bus Tracking API - Rutas y Viajes");
  });

  test("el spec documenta todos los endpoints existentes", async () => {
    const res = await request(app).get("/api/docs.json");
    const { paths } = res.body;
    expect(Object.keys(paths["/health"])).toContain("get");
    expect(Object.keys(paths["/api/auth/admin/login"])).toContain("post");
    expect(Object.keys(paths["/api/auth/oauth/start"])).toContain("post");
    expect(Object.keys(paths["/api/auth/session"])).toContain("get");
    expect(Object.keys(paths["/api/admin/routes"]).sort()).toEqual(["get", "post"]);
    expect(Object.keys(paths["/api/admin/routes/{id}"]).sort()).toEqual([
      "delete",
      "get",
      "put",
    ]);
    expect(Object.keys(paths["/api/admin/routes/{id}/reactivate"])).toContain("post");
    expect(Object.keys(paths["/api/passenger/routes"])).toContain("get");
  });

  test("el spec documenta los endpoints de viajes", async () => {
    const res = await request(app).get("/api/docs.json");
    const { paths } = res.body;
    expect(Object.keys(paths["/api/admin/trips"]).sort()).toEqual(["get", "post"]);
    expect(Object.keys(paths["/api/admin/trips/{id}"]).sort()).toEqual([
      "delete",
      "get",
      "put",
    ]);
    expect(Object.keys(paths["/api/admin/trips/{id}/reactivate"])).toContain("post");
    expect(Object.keys(paths["/api/passenger/trips"])).toContain("get");
  });

  test("el spec declara bearer auth en los endpoints protegidos", async () => {
    const res = await request(app).get("/api/docs.json");
    const { components, paths } = res.body;

    expect(components.securitySchemes).toHaveProperty("bearerAuth");
    expect(paths["/api/admin/routes"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/api/passenger/routes"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/api/admin/trips"].post.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/api/passenger/incidents"].post.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/api/auth/session"].get.security).toEqual([{ bearerAuth: [] }]);
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

  test("OpenAPI document includes driver login endpoint", async () => {
  const response = await request(app).get("/api/docs.json");

  expect(response.status).toBe(200);
  expect(response.body.paths).toHaveProperty("/api/auth/driver/login");
  expect(response.body.paths["/api/auth/driver/login"]).toHaveProperty("post");
});
});
