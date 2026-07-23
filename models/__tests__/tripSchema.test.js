"use strict";

const {
  createTripSchema,
  updateTripSchema,
  idParamSchema,
} = require("../tripSchema");

const validBody = {
  route_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  bus_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  driver_id: "1f9e2c3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  departure_time: "2026-06-21T08:00:00Z",
};

describe("createTripSchema", () => {
  test("acepta un payload valido minimo", () => {
    const result = createTripSchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  test("acepta arrival_time y status opcionales", () => {
    const result = createTripSchema.safeParse({
      ...validBody,
      arrival_time: "2026-06-21T10:00:00Z",
      status: "Pending",
    });
    expect(result.success).toBe(true);
  });

  test("acepta arrival_time nulo", () => {
    const result = createTripSchema.safeParse({ ...validBody, arrival_time: null });
    expect(result.success).toBe(true);
  });

  test("rechaza claves desconocidas (strict)", () => {
    const result = createTripSchema.safeParse({ ...validBody, hacker: true });
    expect(result.success).toBe(false);
  });

  test("rechaza campos requeridos faltantes", () => {
    const result = createTripSchema.safeParse({ route_id: validBody.route_id });
    expect(result.success).toBe(false);
  });

  test("rechaza un route_id que no es UUID", () => {
    const result = createTripSchema.safeParse({ ...validBody, route_id: "nope" });
    expect(result.success).toBe(false);
  });

  test("rechaza un departure_time que no es ISO datetime", () => {
    const result = createTripSchema.safeParse({ ...validBody, departure_time: "manana" });
    expect(result.success).toBe(false);
  });

  test("rechaza un status fuera del enum", () => {
    const result = createTripSchema.safeParse({ ...validBody, status: "Volando" });
    expect(result.success).toBe(false);
  });
});

describe("updateTripSchema", () => {
  test("acepta un cambio parcial", () => {
    const result = updateTripSchema.safeParse({ status: "Delayed" });
    expect(result.success).toBe(true);
  });

  test("rechaza un objeto vacio", () => {
    const result = updateTripSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("rechaza claves desconocidas", () => {
    const result = updateTripSchema.safeParse({ status: "Delayed", extra: 1 });
    expect(result.success).toBe(false);
  });
});

describe("idParamSchema", () => {
  test("rechaza un id no UUID", () => {
    expect(idParamSchema.safeParse({ id: "nope" }).success).toBe(false);
  });

  test("acepta un UUID valido", () => {
    expect(idParamSchema.safeParse({ id: validBody.route_id }).success).toBe(true);
  });
});
