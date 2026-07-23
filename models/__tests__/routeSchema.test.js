"use strict";

const {
  createRouteSchema,
  updateRouteSchema,
  geoJsonRouteGeometrySchema,
  idParamSchema,
} = require("../routeSchema");

const validGeometry = {
  type: "LineString",
  coordinates: [
    [-84.07, 9.93],
    [-84.75, 9.98],
  ],
};

describe("createRouteSchema", () => {
  test("acepta un payload valido", () => {
    const result = createRouteSchema.safeParse({
      name: "San Jose - Puntarenas",
      origin: "San Jose",
      destination: "Puntarenas",
      geometry_geojson: validGeometry,
    });
    expect(result.success).toBe(true);
  });

  test("rechaza claves desconocidas (strict)", () => {
    const result = createRouteSchema.safeParse({
      name: "A",
      origin: "B",
      destination: "C",
      geometry_geojson: validGeometry,
      role: "Admin",
    });
    expect(result.success).toBe(false);
  });

  test("rechaza campos faltantes", () => {
    const result = createRouteSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  test("recorta espacios en name", () => {
    const result = createRouteSchema.safeParse({
      name: "  Ruta  ",
      origin: "B",
      destination: "C",
      geometry_geojson: validGeometry,
    });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe("Ruta");
  });
});

describe("updateRouteSchema", () => {
  test("acepta actualizacion parcial", () => {
    const result = updateRouteSchema.safeParse({ name: "Nuevo" });
    expect(result.success).toBe(true);
  });

  test("rechaza objeto vacio", () => {
    const result = updateRouteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("geoJsonRouteGeometrySchema", () => {
  test("acepta LineString con al menos dos posiciones", () => {
    expect(geoJsonRouteGeometrySchema.safeParse(validGeometry).success).toBe(true);
  });

  test("rechaza LineString con una sola posicion", () => {
    const result = geoJsonRouteGeometrySchema.safeParse({
      type: "LineString",
      coordinates: [[-84.07, 9.93]],
    });
    expect(result.success).toBe(false);
  });

  test("rechaza coordenadas fuera de rango", () => {
    const result = geoJsonRouteGeometrySchema.safeParse({
      type: "LineString",
      coordinates: [
        [-200, 9.93],
        [-84.75, 9.98],
      ],
    });
    expect(result.success).toBe(false);
  });

  test("acepta un Feature<LineString>", () => {
    const result = geoJsonRouteGeometrySchema.safeParse({
      type: "Feature",
      geometry: validGeometry,
      properties: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("idParamSchema", () => {
  test("acepta un UUID valido", () => {
    const result = idParamSchema.safeParse({
      id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });
    expect(result.success).toBe(true);
  });

  test("rechaza un id no UUID", () => {
    expect(idParamSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});
