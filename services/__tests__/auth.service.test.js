"use strict";

jest.mock("../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));

jest.mock("../../repositories/userRepository", () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  createUserProfile: jest.fn(),
}));

jest.mock("../../repositories/passengerRepository", () => ({
  createPassengerProfile: jest.fn(),
}));

jest.mock("../../repositories/authAuditRepository", () => ({
  createLoginAuditLog: jest.fn(),
}));

const { getServiceClient, getAnonClient } = require("../../database/supabaseClient");
const userRepository = require("../../repositories/userRepository");
const passengerRepository = require("../../repositories/passengerRepository");
const authAuditRepository = require("../../repositories/authAuditRepository");
const authService = require("../auth.service");
const { ERROR_CODES } = require("../../constants/errorCodes");
const { ROLES } = require("../../constants/roles");

const validUserId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("auth.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerPassenger", () => {
    test("registers a passenger successfully", async () => {
      const createUserMock = jest.fn().mockResolvedValue({
        data: {
          user: {
            id: validUserId,
          },
        },
        error: null,
      });

      userRepository.findUserByEmail.mockResolvedValue(null);

      getServiceClient.mockReturnValue({
        auth: {
          admin: {
            createUser: createUserMock,
          },
        },
      });

      userRepository.createUserProfile.mockResolvedValue({
        id: validUserId,
        name: "Carlos Marin",
        email: "carlos@example.com",
        role: "Passenger",
      });

      passengerRepository.createPassengerProfile.mockResolvedValue({
        user_id: validUserId,
        phone: "88888888",
        notification_preferences: null,
        is_senior: false,
        expo_push_token: null,
      });

      const result = await authService.registerPassenger({
        name: "Carlos Marin",
        email: "carlos@example.com",
        password: "Password123",
        phone: "88888888",
      });

      expect(userRepository.findUserByEmail).toHaveBeenCalledWith("carlos@example.com");

      expect(createUserMock).toHaveBeenCalledWith({
        email: "carlos@example.com",
        password: "Password123",
        email_confirm: true,
        user_metadata: {
          name: "Carlos Marin",
          role: "Passenger",
        },
      });

      expect(userRepository.createUserProfile).toHaveBeenCalledWith({
        id: validUserId,
        name: "Carlos Marin",
        email: "carlos@example.com",
        role: "Passenger",
      });

      expect(passengerRepository.createPassengerProfile).toHaveBeenCalledWith({
        user_id: validUserId,
        phone: "88888888",
      });

      expect(result).toEqual({
        user: {
          id: validUserId,
          name: "Carlos Marin",
          email: "carlos@example.com",
          role: "Passenger",
        },
        passenger: {
          user_id: validUserId,
          phone: "88888888",
          notification_preferences: null,
          is_senior: false,
          expo_push_token: null,
        },
      });
    });

    test("registers a passenger without phone", async () => {
      const createUserMock = jest.fn().mockResolvedValue({
        data: {
          user: {
            id: validUserId,
          },
        },
        error: null,
      });

      userRepository.findUserByEmail.mockResolvedValue(null);

      getServiceClient.mockReturnValue({
        auth: {
          admin: {
            createUser: createUserMock,
          },
        },
      });

      userRepository.createUserProfile.mockResolvedValue({
        id: validUserId,
        name: "Carlos Marin",
        email: "carlos@example.com",
        role: "Passenger",
      });

      passengerRepository.createPassengerProfile.mockResolvedValue({
        user_id: validUserId,
        phone: null,
        notification_preferences: null,
        is_senior: false,
        expo_push_token: null,
      });

      const result = await authService.registerPassenger({
        name: "Carlos Marin",
        email: "carlos@example.com",
        password: "Password123",
      });

      expect(passengerRepository.createPassengerProfile).toHaveBeenCalledWith({
        user_id: validUserId,
        phone: null,
      });

      expect(result.passenger.phone).toBeNull();
    });

    test("rejects registration when email already exists", async () => {
      userRepository.findUserByEmail.mockResolvedValue({
        id: validUserId,
        email: "carlos@example.com",
      });

      await expect(
        authService.registerPassenger({
          name: "Carlos Marin",
          email: "carlos@example.com",
          password: "Password123",
          phone: "88888888",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_EMAIL_EXISTS,
      });

      expect(getServiceClient).not.toHaveBeenCalled();
      expect(userRepository.createUserProfile).not.toHaveBeenCalled();
      expect(passengerRepository.createPassengerProfile).not.toHaveBeenCalled();
    });

    test("throws an error when Supabase Auth cannot create the user", async () => {
      userRepository.findUserByEmail.mockResolvedValue(null);

      getServiceClient.mockReturnValue({
        auth: {
          admin: {
            createUser: jest.fn().mockResolvedValue({
              data: null,
              error: {
                message: "Supabase create user failed",
              },
            }),
          },
        },
      });

      await expect(
        authService.registerPassenger({
          name: "Carlos Marin",
          email: "carlos@example.com",
          password: "Password123",
          phone: "88888888",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_REGISTER_FAILED,
      });

      expect(userRepository.createUserProfile).not.toHaveBeenCalled();
      expect(passengerRepository.createPassengerProfile).not.toHaveBeenCalled();
    });
  });

  describe("loginUser", () => {
    test("logs in a user successfully", async () => {
      const signInWithPasswordMock = jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
            token_type: "bearer",
          },
          user: {
            id: validUserId,
            email: "carlos@example.com",
            user_metadata: {
              name: "Carlos Marin",
              role: "Passenger",
            },
          },
        },
        error: null,
      });

      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: signInWithPasswordMock,
        },
      });
      userRepository.findUserById.mockResolvedValue({
        id: validUserId,
        email: "carlos@example.com",
        role: "Passenger",
        name: "Carlos Marin",
      });

      const result = await authService.loginUser({
        email: "carlos@example.com",
        password: "Password123",
      });

      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "carlos@example.com",
        password: "Password123",
      });

      expect(result).toEqual({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        capabilities: ["passenger:routes", "passenger:trips", "passenger:incidents"],
        user: {
          id: validUserId,
          email: "carlos@example.com",
          role: "Passenger",
          name: "Carlos Marin",
        },
      });
    });

    test("logs in a user even when metadata is missing", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: "access-token",
                refresh_token: "refresh-token",
                expires_in: 3600,
                token_type: "bearer",
              },
              user: {
                id: validUserId,
                email: "carlos@example.com",
                user_metadata: null,
              },
            },
            error: null,
          }),
        },
      });
      userRepository.findUserById.mockResolvedValue(null);

      const result = await authService.loginUser({
        email: "carlos@example.com",
        password: "Password123",
      });

      expect(result.user.role).toBeNull();
      expect(result.user.name).toBeNull();
    });

    test("uses the database role and writes a successful audit log", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: "access-token",
                refresh_token: "refresh-token",
                expires_in: 3600,
                token_type: "bearer",
              },
              user: {
                id: validUserId,
                email: "admin@example.com",
                user_metadata: {
                  name: "Metadata Name",
                  role: "Passenger",
                },
              },
            },
            error: null,
          }),
        },
      });
      userRepository.findUserById.mockResolvedValue({
        id: validUserId,
        email: "admin@example.com",
        role: ROLES.ADMIN,
        name: "Manager Admin",
      });

      const result = await authService.loginUser(
        { email: "admin@example.com", password: "Password123" },
        { ipAddress: "127.0.0.1", userAgent: "jest" },
      );

      expect(result.user.role).toBe(ROLES.ADMIN);
      expect(result.user.name).toBe("Manager Admin");
      expect(result.capabilities).toContain("auth:admin");
      expect(authAuditRepository.createLoginAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: validUserId,
          email: "admin@example.com",
          role: ROLES.ADMIN,
          auth_strategy: "password",
          was_successful: true,
        }),
      );
    });

    test("rejects invalid login credentials", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: null,
            error: {
              message: "Invalid login credentials",
            },
          }),
        },
      });

      await expect(
        authService.loginUser({
          email: "carlos@example.com",
          password: "WrongPassword123",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_LOGIN_FAILED,
      });

      expect(authAuditRepository.createLoginAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "carlos@example.com",
          auth_strategy: "password",
          was_successful: false,
          failure_code: ERROR_CODES.AUTH_LOGIN_FAILED,
        }),
      );
    });

    test("rejects login when session is missing", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              session: null,
              user: {
                id: validUserId,
                email: "carlos@example.com",
              },
            },
            error: null,
          }),
        },
      });

      await expect(
        authService.loginUser({
          email: "carlos@example.com",
          password: "Password123",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_LOGIN_FAILED,
      });
    });

    test("rejects admin login for non-admin users", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: "access-token",
                refresh_token: "refresh-token",
                expires_in: 3600,
                token_type: "bearer",
              },
              user: {
                id: validUserId,
                email: "carlos@example.com",
                user_metadata: {
                  name: "Carlos Marin",
                  role: ROLES.PASSENGER,
                },
              },
            },
            error: null,
          }),
        },
      });
      userRepository.findUserById.mockResolvedValue({
        id: validUserId,
        email: "carlos@example.com",
        role: ROLES.PASSENGER,
        name: "Carlos Marin",
      });

      await expect(
        authService.loginAdmin({ email: "carlos@example.com", password: "Password123" }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_ADMIN_REQUIRED,
      });
    });

    test("starts an OAuth flow", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithOAuth: jest.fn().mockResolvedValue({
            data: { url: "https://auth.example.com/google" },
            error: null,
          }),
        },
      });

      await expect(
        authService.startOAuth({ provider: "google", redirect_to: "https://app.example.com/callback" }),
      ).resolves.toEqual({
        provider: "google",
        authorization_url: "https://auth.example.com/google",
      });
    });

    test("builds the mobile session payload", async () => {
      userRepository.findUserById.mockResolvedValue({
        id: validUserId,
        email: "admin@example.com",
        role: ROLES.ADMIN,
        name: "Manager Admin",
      });

      await expect(
        authService.getSession({ userId: validUserId, role: ROLES.PASSENGER }),
      ).resolves.toEqual({
        user_id: validUserId,
        email: "admin@example.com",
        role: ROLES.ADMIN,
        capabilities: ["admin:routes", "admin:trips", "auth:admin"],
      });
    });
  });
});