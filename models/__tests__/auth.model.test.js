"use strict";

const {
  registerPassengerSchema,
  loginSchema,
} = require("../auth.model");

describe("registerPassengerSchema", () => {
  test("accepts a valid passenger registration payload", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Carlos Marin",
      email: "carlos@example.com",
      password: "Password123",
      phone: "88888888",
    });

    expect(result.success).toBe(true);
  });

  test("accepts a payload without phone", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Carlos Marin",
      email: "carlos@example.com",
      password: "Password123",
    });

    expect(result.success).toBe(true);
  });

  test("rejects an invalid email", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Carlos Marin",
      email: "invalid-email",
      password: "Password123",
      phone: "88888888",
    });

    expect(result.success).toBe(false);
  });

  test("rejects a short password", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Carlos Marin",
      email: "carlos@example.com",
      password: "123",
      phone: "88888888",
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Carlos Marin",
      email: "carlos@example.com",
      password: "Password123",
      phone: "88888888",
      role: "Admin",
    });

    expect(result.success).toBe(false);
  });

  test("trims name and email", () => {
    const result = registerPassengerSchema.safeParse({
      name: "  Carlos Marin  ",
      email: "  carlos@example.com  ",
      password: "Password123",
      phone: "88888888",
    });

    expect(result.success).toBe(true);
    expect(result.data.name).toBe("Carlos Marin");
    expect(result.data.email).toBe("carlos@example.com");
  });
});

describe("loginSchema", () => {
  test("accepts a valid login payload", () => {
    const result = loginSchema.safeParse({
      email: "carlos@example.com",
      password: "Password123",
    });

    expect(result.success).toBe(true);
  });

  test("rejects missing password", () => {
    const result = loginSchema.safeParse({
      email: "carlos@example.com",
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys", () => {
    const result = loginSchema.safeParse({
      email: "carlos@example.com",
      password: "Password123",
      role: "Passenger",
    });

    expect(result.success).toBe(false);
  });
});