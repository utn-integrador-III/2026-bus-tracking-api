"use strict";

const routeView = require("../routeView");

const row = {
  id: "uuid-1",
  name: "SJ-PT",
  origin: "San Jose",
  destination: "Puntarenas",
  geometry_geojson: { type: "LineString", coordinates: [] },
  is_active: true,
  created_at: "2026-06-20T12:00:00.000Z",
};

describe("presentAdminRoute", () => {
  test("expone todos los campos administrativos", () => {
    const out = routeView.presentAdminRoute(row);
    expect(out).toEqual({
      id: "uuid-1",
      name: "SJ-PT",
      origin: "San Jose",
      destination: "Puntarenas",
      geometry_geojson: { type: "LineString", coordinates: [] },
      is_active: true,
      created_at: "2026-06-20T12:00:00.000Z",
    });
  });
});

describe("presentConsumerRoute", () => {
  test("deriva status Active cuando is_active es true", () => {
    expect(routeView.presentConsumerRoute(row).status).toBe("Active");
  });

  test("deriva status Inactive cuando is_active es false", () => {
    expect(routeView.presentConsumerRoute({ ...row, is_active: false }).status).toBe(
      "Inactive",
    );
  });

  test("no expone campos internos de auditoria", () => {
    const out = routeView.presentConsumerRoute(row);
    expect(out).not.toHaveProperty("is_active");
    expect(out).not.toHaveProperty("created_at");
  });
});

describe("envelopes de mutacion", () => {
  test("created devuelve solo el id", () => {
    expect(routeView.created(row)).toEqual({ id: "uuid-1" });
  });

  test("updated devuelve updated true", () => {
    expect(routeView.updated()).toEqual({ updated: true });
  });

  test("deleted devuelve deleted true", () => {
    expect(routeView.deleted()).toEqual({ deleted: true });
  });

  test("reactivated devuelve reactivated true", () => {
    expect(routeView.reactivated()).toEqual({ reactivated: true });
  });
});
