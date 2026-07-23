"use strict";

const {
  createDriverSchema,
  updateDriverSchema,
  idParamSchema,
} = require("../driver.model");

const validId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("createDriverSchema", () => {
  test("accepts a valid driver creation payload", () => {
    const result = createDriverSchema.safeParse({
      name: "Carlos Gomez",
      email: "driver@example.com",
      password: "Password123",
      license_number: "B1-123456",
    });

    expect(result.success).toBe(true);
  });

  test("rejects an invalid email", () => {
    const result = createDriverSchema.safeParse({
      name: "Carlos Gomez",
      email: "invalid-email",
      password: "Password123",
      license_number: "B1-123456",
    });

    expect(result.success).toBe(false);
  });

  test("rejects short password", () => {
    const result = createDriverSchema.safeParse({
      name: "Carlos Gomez",
      email: "driver@example.com",
      password: "123",
      license_number: "B1-123456",
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys", () => {
    const result = createDriverSchema.safeParse({
      name: "Carlos Gomez",
      email: "driver@example.com",
      password: "Password123",
      license_number: "B1-123456",
      role: "Admin",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateDriverSchema", () => {
  test("accepts partial update", () => {
    const result = updateDriverSchema.safeParse({
      license_number: "B2-999999",
    });

    expect(result.success).toBe(true);
  });

  test("rejects empty object", () => {
    const result = updateDriverSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  test("rejects short password", () => {
    const result = updateDriverSchema.safeParse({
      password: "123",
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys", () => {
    const result = updateDriverSchema.safeParse({
      is_admin: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("idParamSchema", () => {
  test("accepts valid UUID", () => {
    expect(idParamSchema.safeParse({ id: validId }).success).toBe(true);
  });

  test("rejects invalid UUID", () => {
    expect(idParamSchema.safeParse({ id: "invalid-id" }).success).toBe(false);
  });
});