"use strict";

jest.mock("../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));

jest.mock("../../repositories/userRepository", () => ({
  findUserByEmail: jest.fn(),
  createUserProfile: jest.fn(),
}));

jest.mock("../../repositories/passengerRepository", () => ({
  createPassengerProfile: jest.fn(),
}));

const { getServiceClient, getAnonClient } = require("../../database/supabaseClient");
const userRepository = require("../../repositories/userRepository");
const passengerRepository = require("../../repositories/passengerRepository");
const authService = require("../auth.service");
const { ERROR_CODES } = require("../../constants/errorCodes");

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

      const result = await authService.loginUser({
        email: "carlos@example.com",
        password: "Password123",
      });

      expect(result.user.role).toBeNull();
      expect(result.user.name).toBeNull();
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
  });
});