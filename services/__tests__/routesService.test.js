"use strict";

jest.mock("../../repositories/routesRepository");

const routesRepository = require("../../repositories/routesRepository");
const routesService = require("../routesService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("listAll / listActive", () => {
  test("listAll pide incluyendo inactivas", async () => {
    routesRepository.listRoutes.mockResolvedValue([]);
    await routesService.listAll();
    expect(routesRepository.listRoutes).toHaveBeenCalledWith({ includeInactive: true });
  });

  test("listActive pide solo activas", async () => {
    routesRepository.listRoutes.mockResolvedValue([]);
    await routesService.listActive();
    expect(routesRepository.listRoutes).toHaveBeenCalledWith({ includeInactive: false });
  });
});

describe("getById", () => {
  test("lanza 404 cuando la ruta no existe", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    await expect(routesService.getById("id")).rejects.toMatchObject({
      statusCode: 404,
      code: "ROUTE_NOT_FOUND",
    });
  });

  test("devuelve la fila cuando existe", async () => {
    routesRepository.getRouteById.mockResolvedValue({ id: "id", is_active: false });
    await expect(routesService.getById("id")).resolves.toEqual({
      id: "id",
      is_active: false,
    });
  });
});

describe("create", () => {
  test("envia solo los campos permitidos al repositorio", async () => {
    routesRepository.createRoute.mockResolvedValue({ id: "x" });
    await routesService.create({
      name: "A",
      origin: "B",
      destination: "C",
      geometry_geojson: { type: "LineString", coordinates: [] },
      hacker: true,
    });
    expect(routesRepository.createRoute).toHaveBeenCalledWith({
      name: "A",
      origin: "B",
      destination: "C",
      geometry_geojson: { type: "LineString", coordinates: [] },
    });
  });
});

describe("update", () => {
  test("lanza 404 cuando la ruta no existe", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    await expect(routesService.update("id", { name: "X" })).rejects.toMatchObject({
      statusCode: 404,
      code: "ROUTE_NOT_FOUND",
    });
    expect(routesRepository.updateRoute).not.toHaveBeenCalled();
  });

  test("solo aplica los campos presentes", async () => {
    routesRepository.getRouteById.mockResolvedValue({ id: "id" });
    routesRepository.updateRoute.mockResolvedValue({ id: "id" });
    await routesService.update("id", { name: "Nuevo" });
    expect(routesRepository.updateRoute).toHaveBeenCalledWith("id", { name: "Nuevo" });
  });
});

describe("deactivate", () => {
  test("lanza 404 cuando la ruta no existe", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    await expect(routesService.deactivate("id")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(routesRepository.setRouteActive).not.toHaveBeenCalled();
  });

  test("desactiva con is_active false", async () => {
    routesRepository.getRouteById.mockResolvedValue({ id: "id" });
    routesRepository.setRouteActive.mockResolvedValue({ id: "id", is_active: false });
    await routesService.deactivate("id");
    expect(routesRepository.setRouteActive).toHaveBeenCalledWith("id", false);
  });
});

describe("reactivate", () => {
  test("lanza 404 cuando la ruta no existe", async () => {
    routesRepository.getRouteById.mockResolvedValue(null);
    await expect(routesService.reactivate("id")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(routesRepository.setRouteActive).not.toHaveBeenCalled();
  });

  test("reactiva con is_active true", async () => {
    routesRepository.getRouteById.mockResolvedValue({ id: "id", is_active: false });
    routesRepository.setRouteActive.mockResolvedValue({ id: "id", is_active: true });
    await routesService.reactivate("id");
    expect(routesRepository.setRouteActive).toHaveBeenCalledWith("id", true);
  });
});
