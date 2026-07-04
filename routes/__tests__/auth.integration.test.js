"use strict";

jest.mock("../../services/auth.service", () => ({
  registerPassenger: jest.fn(),
  loginUser: jest.fn(),
  loginAdmin: jest.fn(),
  startOAuth: jest.fn(),
  getSession: jest.fn(),
  loginDriver: jest.fn(),
  createSeniorDocumentUploadUrl: jest.fn(),
}));

jest.mock("../../database/supabaseClient", () => ({
  verifyAccessToken: jest.fn(),
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));

jest.mock("../../repositories/userRepository", () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  createUserProfile: jest.fn(),
}));

const request = require("supertest");
const buildApp = require("../../app");
const authService = require("../../services/auth.service");
const { verifyAccessToken } = require("../../database/supabaseClient");
const userRepository = require("../../repositories/userRepository");
const { ROLES } = require("../../constants/roles");

const app = buildApp();
const validUserId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const authToken = "test-token";

describe("auth routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/senior-document/upload-url", () => {
    test("returns 200 when the upload URL is created", async () => {
      authService.createSeniorDocumentUploadUrl.mockResolvedValue({
        bucket: "cedulas",
        path: "passengers/senior.passenger@example.com/cedula.jpg",
        signed_url: "https://storage.example.com/upload",
        token: "upload-token",
      });

      const response = await request(app)
        .post("/api/auth/senior-document/upload-url")
        .send({
          email: "senior.passenger@example.com",
          file_name: "cedula.jpg",
          content_type: "image/jpeg",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        bucket: "cedulas",
        path: "passengers/senior.passenger@example.com/cedula.jpg",
        signed_url: "https://storage.example.com/upload",
        token: "upload-token",
      });
      expect(authService.createSeniorDocumentUploadUrl).toHaveBeenCalledWith({
        email: "senior.passenger@example.com",
        file_name: "cedula.jpg",
        content_type: "image/jpeg",
      });
    });

    test("returns 400 for unsupported content types", async () => {
      const response = await request(app)
        .post("/api/auth/senior-document/upload-url")
        .send({
          email: "senior.passenger@example.com",
          file_name: "cedula.pdf",
          content_type: "application/pdf",
        });

      expect(response.status).toBe(400);
      expect(authService.createSeniorDocumentUploadUrl).not.toHaveBeenCalled();
    });
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
        is_senior_request: false,
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

    test.each(["Driver", "Admin"])("returns 400 when public registration tries role %s", async (role) => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Carlos Marin",
          email: "carlos@example.com",
          password: "Password123",
          phone: "88888888",
          role,
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

      expect(authService.loginUser).toHaveBeenCalledWith(
        {
          email: "carlos@example.com",
          password: "Password123",
        },
        expect.objectContaining({ ipAddress: expect.any(String) }),
      );
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

  describe("POST /api/auth/admin/login", () => {
    test("returns 200 when admin login succeeds", async () => {
      authService.loginAdmin.mockResolvedValue({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: validUserId,
          email: "admin@example.com",
          role: ROLES.ADMIN,
          name: "Manager Admin",
        },
        capabilities: ["auth:admin"],
      });

      const response = await request(app)
        .post("/api/auth/admin/login")
        .send({ email: "admin@example.com", password: "Password123" });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe(ROLES.ADMIN);
      expect(authService.loginAdmin).toHaveBeenCalledWith(
        { email: "admin@example.com", password: "Password123" },
        expect.objectContaining({ ipAddress: expect.any(String) }),
      );
    });
  });

  describe("POST /api/auth/driver/login", () => {
    test("returns 200 when driver login succeeds", async () => {
      authService.loginDriver.mockResolvedValue({
        access_token: "driver-access-token",
        refresh_token: "driver-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: validUserId,
          email: "driver@example.com",
          role: "Driver",
          name: "Carlos Driver",
        },
      });

      const response = await request(app)
        .post("/api/auth/driver/login")
        .send({
          email: "driver@example.com",
          password: "Password123",
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe("Driver");

      expect(authService.loginDriver).toHaveBeenCalledWith({
        email: "driver@example.com",
        password: "Password123",
      },
      {ipAddress: "::ffff:127.0.0.1", userAgent: null}
    );
    });

    test("returns 400 when driver login payload is invalid", async () => {
      const response = await request(app)
        .post("/api/auth/driver/login")
        .send({
          email: "invalid-email",
          password: "Password123",
        });

      expect(response.status).toBe(400);
      expect(authService.loginDriver).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/oauth/start", () => {
    test("returns the OAuth authorization url", async () => {
      authService.startOAuth.mockResolvedValue({
        provider: "google",
        authorization_url: "https://auth.example.com/google",
      });

      const response = await request(app)
        .post("/api/auth/oauth/start")
        .send({
          provider: "google",
          redirect_to: "https://app.example.com/callback",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        provider: "google",
        authorization_url: "https://auth.example.com/google",
      });

      expect(authService.startOAuth).toHaveBeenCalledWith({
        provider: "google",
        redirect_to: "https://app.example.com/callback",
      });
    });
  });

  describe("GET /api/auth/session", () => {
    test("returns the current session role and capabilities", async () => {
      userRepository.findUserById.mockResolvedValue({
        id: validUserId,
        email: "admin@example.com",
        role: ROLES.ADMIN,
      });

      verifyAccessToken.mockResolvedValue({
        id: validUserId,
        app_metadata: { role: ROLES.ADMIN },
      });

      authService.getSession.mockResolvedValue({
        user_id: validUserId,
        email: "admin@example.com",
        role: ROLES.ADMIN,
        capabilities: ["auth:admin"],
      });

      const response = await request(app)
        .get("/api/auth/session")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user_id: validUserId,
        email: "admin@example.com",
        role: ROLES.ADMIN,
        capabilities: ["auth:admin"],
      });

      expect(authService.getSession).toHaveBeenCalledWith({
        userId: validUserId,
        role: ROLES.ADMIN,
      });
    });
  });
});
