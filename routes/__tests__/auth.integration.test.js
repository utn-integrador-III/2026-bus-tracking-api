"use strict";

jest.mock("../../services/auth.service", () => ({
  registerPassenger: jest.fn(),
  loginUser: jest.fn(),
}));

const request = require("supertest");
const buildApp = require("../../app");
const authService = require("../../services/auth.service");

const app = buildApp();
const validUserId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("auth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    test("returns 201 when passenger registration succeeds", async () => {
      authService.registerPassenger.mockResolvedValue({
        user: {
          id: validUserId,
          role: "Passenger",
        },
        passenger: {
          user_id: validUserId,
          phone: "88888888",
        },
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Carlos Marin",
          email: "carlos@example.com",
          password: "Password123",
          phone: "88888888",
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        user_id: validUserId,
        role: "Passenger",
        passenger: {
          user_id: validUserId,
          phone: "88888888",
        },
      });

      expect(authService.registerPassenger).toHaveBeenCalledWith({
        name: "Carlos Marin",
        email: "carlos@example.com",
        password: "Password123",
        phone: "88888888",
      });
    });

    test("returns 400 when registration payload is invalid", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Carlos Marin",
          email: "invalid-email",
          password: "123",
          phone: "88888888",
        });

      expect(response.status).toBe(400);
      expect(authService.registerPassenger).not.toHaveBeenCalled();
    });

    test("returns 400 when registration payload has unknown keys", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Carlos Marin",
          email: "carlos@example.com",
          password: "Password123",
          phone: "88888888",
          role: "Admin",
        });

      expect(response.status).toBe(400);
      expect(authService.registerPassenger).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/login", () => {
    test("returns 200 when login succeeds", async () => {
      authService.loginUser.mockResolvedValue({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: validUserId,
          email: "carlos@example.com",
          role: "Passenger",
          name: "Carlos Marin",
        },
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "carlos@example.com",
          password: "Password123",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: validUserId,
          email: "carlos@example.com",
          role: "Passenger",
          name: "Carlos Marin",
        },
      });

      expect(authService.loginUser).toHaveBeenCalledWith({
        email: "carlos@example.com",
        password: "Password123",
      });
    });

    test("returns 400 when login payload is invalid", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "invalid-email",
          password: "Password123",
        });

      expect(response.status).toBe(400);
      expect(authService.loginUser).not.toHaveBeenCalled();
    });

    test("returns 400 when password is missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "carlos@example.com",
        });

      expect(response.status).toBe(400);
      expect(authService.loginUser).not.toHaveBeenCalled();
    });
  });
});