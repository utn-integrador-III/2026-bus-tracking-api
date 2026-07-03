"use strict";

const {
  registerPassengerSchema,
  loginSchema,
  seniorDocumentUploadUrlSchema,
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

  test.each(["Driver", "Admin"])("rejects public registration role escalation to %s", (role) => {
    const result = registerPassengerSchema.safeParse({
      name: "Carlos Marin",
      email: "carlos@example.com",
      password: "Password123",
      phone: "88888888",
      role,
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
  test("normalizes email to lowercase for case-insensitive uniqueness", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Carlos Marin",
      email: "FOO@X.COM",
      password: "Password123",
      phone: "88888888",
    });

    expect(result.success).toBe(true);
    expect(result.data.email).toBe("foo@x.com");
  });

  test("rejects a senior request with a non-existent calendar date", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Senior Passenger",
      email: "senior.passenger@example.com",
      password: "Password123",
      is_senior_request: true,
      birth_date: "1950-13-40",
      document_image_path: "passengers/senior.passenger@example.com/cedula.jpg",
    });

    expect(result.success).toBe(false);
  });

  test("accepts a senior request with a real birth date", () => {
    const result = registerPassengerSchema.safeParse({
      name: "Senior Passenger",
      email: "senior.passenger@example.com",
      password: "Password123",
      is_senior_request: true,
      birth_date: "1960-05-10",
      document_image_path: "passengers/senior.passenger@example.com/cedula.jpg",
    });

    expect(result.success).toBe(true);
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
describe("seniorDocumentUploadUrlSchema", () => {
  test("accepts a valid senior document upload payload", () => {
    const result = seniorDocumentUploadUrlSchema.safeParse({
      email: "senior.passenger@example.com",
      file_name: "cedula-frontal.jpg",
      content_type: "image/jpeg",
    });

    expect(result.success).toBe(true);
  });

  test("rejects unsupported document content types", () => {
    const result = seniorDocumentUploadUrlSchema.safeParse({
      email: "senior.passenger@example.com",
      file_name: "cedula.pdf",
      content_type: "application/pdf",
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys", () => {
    const result = seniorDocumentUploadUrlSchema.safeParse({
      email: "senior.passenger@example.com",
      file_name: "cedula.jpg",
      content_type: "image/jpeg",
      role: "Admin",
    });

    expect(result.success).toBe(false);
  });
});
