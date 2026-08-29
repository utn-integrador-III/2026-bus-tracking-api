"use strict";

const crypto = require("crypto");

jest.mock("../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));

jest.mock("../../repositories/seniorVerificationRepository", () => ({
  createPendingRequest: jest.fn(),
}));

jest.mock("../../repositories/userRepository", () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  createUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  setUserActive: jest.fn(),
}));

jest.mock("../../repositories/userRoleRepository", () => ({
  createUserRole: jest.fn(),
  findRoleByUserId: jest.fn(),
  findRoleByUserIdAndRole: jest.fn(),
}));

jest.mock("../../repositories/passengerRepository", () => ({
  createPassengerProfile: jest.fn(),
  updatePassengerProfile: jest.fn(),
  findPassengerById: jest.fn(),
}));

jest.mock("../../repositories/authAuditRepository", () => ({
  createLoginAuditLog: jest.fn(),
}));

const { getServiceClient, getAnonClient } = require("../../database/supabaseClient");
const userRepository = require("../../repositories/userRepository");
const userRoleRepository = require("../../repositories/userRoleRepository");
const seniorVerificationRepository = require("../../repositories/seniorVerificationRepository");
const passengerRepository = require("../../repositories/passengerRepository");
const authAuditRepository = require("../../repositories/authAuditRepository");
const authService = require("../auth.service");
const { ERROR_CODES } = require("../../constants/errorCodes");
const { ROLES } = require("../../constants/roles");

const validUserId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const seniorEmail = "senior.passenger@example.com";
const seniorOwner = crypto.createHash("sha256").update(seniorEmail).digest("hex");
const seniorDocumentPath = `registrations/${seniorOwner}/cedula.jpg`;

describe("auth.service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createSeniorDocumentUploadUrl", () => {
    test("creates a signed upload URL in the senior documents bucket", async () => {
      jest.spyOn(Date, "now").mockReturnValue(1782511200000);

      const createSignedUploadUrl = jest.fn().mockResolvedValue({
        data: {
          signedUrl: "https://storage.example.com/upload",
          path: "passengers/3f2504e0-4f89-41d3-9a0c-0305e82c3301/1782511200000-cedula-frontal.jpg",
          token: "upload-token",
        },
        error: null,
      });
      const from = jest.fn().mockReturnValue({ createSignedUploadUrl });

      getServiceClient.mockReturnValue({
        storage: { from },
      });

      const result = await authService.createSeniorDocumentUploadUrl({
        user_id: "3F2504E0-4F89-41D3-9A0C-0305E82C3301",
        file_name: "Cedula Frontal.JPG",
        content_type: "image/jpeg",
      });

      expect(from).toHaveBeenCalledWith("cedulas");
      expect(createSignedUploadUrl).toHaveBeenCalledWith(
        "passengers/3f2504e0-4f89-41d3-9a0c-0305e82c3301/1782511200000-cedula-frontal.jpg",
      );
      expect(result).toEqual({
        bucket: "cedulas",
        path: "passengers/3f2504e0-4f89-41d3-9a0c-0305e82c3301/1782511200000-cedula-frontal.jpg",
        signed_url: "https://storage.example.com/upload",
        token: "upload-token",
      });
    });

    test("throws when Supabase Storage cannot create the signed URL", async () => {
      const createSignedUploadUrl = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "bucket not found" },
      });

      getServiceClient.mockReturnValue({
        storage: {
          from: jest.fn().mockReturnValue({ createSignedUploadUrl }),
        },
      });

      await expect(
        authService.createSeniorDocumentUploadUrl({
          user_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          file_name: "cedula.jpg",
          content_type: "image/jpeg",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_SENIOR_DOCUMENT_UPLOAD_FAILED,
        statusCode: 500,
      });
    });
  });
  describe("createSeniorPreRegistrationUploadUrl", () => {
    test("creates an email-scoped signed URL", async () => {
      jest.spyOn(crypto, "randomUUID").mockReturnValue("document-id");
      const expectedPath = `registrations/${seniorOwner}/document-id-cedula.jpg`;
      const createSignedUploadUrl = jest.fn().mockResolvedValue({
        data: {
          signedUrl: "https://storage.example.com/upload",
          path: expectedPath,
          token: "upload-token",
        },
        error: null,
      });
      getServiceClient.mockReturnValue({
        storage: { from: jest.fn().mockReturnValue({ createSignedUploadUrl }) },
      });

      const result = await authService.createSeniorPreRegistrationUploadUrl({
        email: seniorEmail,
        file_name: "Cedula.JPG",
        content_type: "image/jpeg",
      });

      expect(createSignedUploadUrl).toHaveBeenCalledWith(expectedPath);
      expect(result.path).toBe(expectedPath);
    });
  });
  describe("registerPassenger", () => {
    test("rejects a senior document issued for a different email", async () => {
      await expect(
        authService.registerPassenger({
          name: "Senior Passenger",
          email: "different@example.com",
          password: "Password123",
          is_senior_request: true,
          birth_date: "1960-05-10",
          document_image_path: seniorDocumentPath,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODES.AUTH_VALIDATION_FAILED,
      });

      expect(userRepository.findUserByEmail).not.toHaveBeenCalled();
    });

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
        is_active: true,
        deactivated_at: null,
        created_at: "2026-06-20T10:00:00Z",
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

      expect(result.user.role).toBe("Passenger");
      expect(result.passenger.phone).toBe("88888888");
      expect(seniorVerificationRepository.createPendingRequest).not.toHaveBeenCalled();
    });

    test("registers a senior passenger request and leaves the account inactive", async () => {
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
        name: "Senior Passenger",
        email: "senior.passenger@example.com",
        role: "Passenger",
        is_active: false,
        deactivated_at: null,
        created_at: "2026-06-20T10:00:00Z",
      });

      userRepository.setUserActive.mockResolvedValue({
        id: validUserId,
        name: "Senior Passenger",
        email: "senior.passenger@example.com",
        role: "Passenger",
        is_active: false,
        deactivated_at: "2026-06-20T10:00:00Z",
        created_at: "2026-06-20T10:00:00Z",
      });

      passengerRepository.createPassengerProfile.mockResolvedValue({
        user_id: validUserId,
        phone: "88882222",
        notification_preferences: null,
        is_senior: false,
        expo_push_token: null,
        birth_date: "1960-05-10",
        senior_status: "pending",
      });

      passengerRepository.updatePassengerProfile.mockResolvedValue({
        user_id: validUserId,
        phone: "88882222",
        notification_preferences: null,
        is_senior: false,
        expo_push_token: null,
        birth_date: "1960-05-10",
        senior_status: "pending",
      });

      seniorVerificationRepository.createPendingRequest.mockResolvedValue({
        id: "senior-request-id",
        passenger_id: validUserId,
        document_image_bucket: "cedulas",
        document_image_path: seniorDocumentPath,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        created_at: "2026-06-20T10:00:00Z",
        updated_at: "2026-06-20T10:00:00Z",
      });

      const result = await authService.registerPassenger({
        name: "Senior Passenger",
        email: "senior.passenger@example.com",
        password: "Password123",
        phone: "88882222",
        is_senior_request: true,
        birth_date: "1960-05-10",
        document_image_path: seniorDocumentPath,
      });

      expect(createUserMock).toHaveBeenCalledWith({
        email: "senior.passenger@example.com",
        password: "Password123",
        email_confirm: true,
        user_metadata: {
          name: "Senior Passenger",
          role: "Passenger",
        },
      });

      expect(userRepository.createUserProfile).toHaveBeenCalledWith({
        id: validUserId,
        name: "Senior Passenger",
        email: "senior.passenger@example.com",
        role: "Passenger",
      });

      expect(passengerRepository.createPassengerProfile).toHaveBeenCalledWith({
        user_id: validUserId,
        phone: "88882222",
      });

      expect(passengerRepository.updatePassengerProfile).toHaveBeenCalledWith(validUserId, {
        birth_date: "1960-05-10",
      });

      expect(seniorVerificationRepository.createPendingRequest).toHaveBeenCalledWith({
        passenger_id: validUserId,
        document_image_bucket: "cedulas",
        document_image_path: seniorDocumentPath,
        status: "pending",
      });

      expect(result.user.is_active).toBe(false);
      expect(result.user.role).toBe("Passenger");
      expect(result.passenger.senior_status).toBe("pending");
      expect(result.passenger.is_senior).toBe(false);
      expect(result.senior_verification_request.status).toBe("pending");
      expect(result.senior_verification_request.document_image_bucket).toBe("cedulas");
    });

    test("forces Passenger role even when the payload is manipulated", async () => {
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
        role: ROLES.PASSENGER,
      });

      passengerRepository.createPassengerProfile.mockResolvedValue({
        user_id: validUserId,
        phone: "88888888",
        notification_preferences: null,
        is_senior: false,
        expo_push_token: null,
      });

      await authService.registerPassenger({
        name: "Carlos Marin",
        email: "carlos@example.com",
        password: "Password123",
        phone: "88888888",
        role: ROLES.DRIVER,
      });

      expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({
        user_metadata: {
          name: "Carlos Marin",
          role: ROLES.PASSENGER,
        },
      }));

      expect(userRepository.createUserProfile).toHaveBeenCalledWith({
        id: validUserId,
        name: "Carlos Marin",
        email: "carlos@example.com",
        role: ROLES.PASSENGER,
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
        is_active: true,
        deactivated_at: null,
        created_at: "2026-06-20T10:00:00Z",
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
      expect(userRoleRepository.createUserRole).not.toHaveBeenCalled();
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
      expect(userRoleRepository.createUserRole).not.toHaveBeenCalled();
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

      userRoleRepository.findRoleByUserId.mockResolvedValue({
        id: "role-id",
        user_id: validUserId,
        role: "Passenger",
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
          is_senior: false,
          senior_status: "not_applicable",
        },
      });
    });

    test("rejects login for a deactivated account", async () => {
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
                email: "senior.passenger@example.com",
                user_metadata: {
                  name: "Senior Passenger",
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
        email: "senior.passenger@example.com",
        role: "Passenger",
        name: "Senior Passenger",
        is_active: false,
        deactivated_at: "2026-08-01T01:18:52.365Z",
      });

      await expect(
        authService.loginUser({
          email: "senior.passenger@example.com",
          password: "Password123",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_ACCOUNT_DEACTIVATED,
        statusCode: 403,
      });

      expect(authAuditRepository.createLoginAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: validUserId,
          was_successful: false,
          failure_code: ERROR_CODES.AUTH_ACCOUNT_DEACTIVATED,
        }),
      );
    });

    test("exposes the senior flag for an approved senior passenger", async () => {
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
                email: "senior.passenger@example.com",
                user_metadata: {
                  name: "Senior Passenger",
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
        email: "senior.passenger@example.com",
        role: "Passenger",
        name: "Senior Passenger",
      });

      passengerRepository.findPassengerById.mockResolvedValue({
        user_id: validUserId,
        is_senior: true,
        senior_status: "approved",
      });

      const result = await authService.loginUser({
        email: "senior.passenger@example.com",
        password: "Password123",
      });

      expect(passengerRepository.findPassengerById).toHaveBeenCalledWith(validUserId);
      expect(result.user.is_senior).toBe(true);
      expect(result.user.senior_status).toBe("approved");
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

      userRoleRepository.findRoleByUserId.mockResolvedValue({
        id: "role-id",
        user_id: validUserId,
        role: "Passenger",
      });

      const result = await authService.loginUser({
        email: "carlos@example.com",
        password: "Password123",
      });

      expect(result.user.role).toBeNull();
      expect(result.user.name).toBeNull();
    });

    test("returns null role when user role does not exist", async () => {
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
                },
              },
            },
            error: null,
          }),
        },
      });

      userRepository.findUserById.mockResolvedValue(null);
      userRoleRepository.findRoleByUserId.mockResolvedValue(null);

      const result = await authService.loginUser({
        email: "carlos@example.com",
        password: "Password123",
      });

      expect(result.user.role).toBeNull();
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
        authService.loginAdmin({
          email: "carlos@example.com",
          password: "Password123",
        }),
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
        authService.startOAuth({
          provider: "google",
          redirect_to: "https://app.example.com/callback",
        }),
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

  describe("loginDriver", () => {
    test("logs in a driver successfully", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: "driver-access-token",
                refresh_token: "driver-refresh-token",
                expires_in: 3600,
                token_type: "bearer",
              },
              user: {
                id: validUserId,
                email: "driver@example.com",
                user_metadata: {
                  name: "Carlos Driver",
                },
              },
            },
            error: null,
          }),
        },
      });

      userRepository.findUserById.mockResolvedValue({
        id: validUserId,
        email: "driver@example.com",
        role: "Driver",
        name: "Carlos Driver",
      });

      userRoleRepository.findRoleByUserId.mockResolvedValue({
        id: "role-id",
        user_id: validUserId,
        role: "Driver",
      });

      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue({
        id: "role-id",
        user_id: validUserId,
        role: "Driver",
      });

      const result = await authService.loginDriver({
        email: "driver@example.com",
        password: "Password123",
      });

      expect(result.access_token).toBe("driver-access-token");
      expect(result.user.role).toBe("Driver");
    });

    test("rejects login when user is not a driver", async () => {
      getAnonClient.mockReturnValue({
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: "passenger-access-token",
                refresh_token: "passenger-refresh-token",
                expires_in: 3600,
                token_type: "bearer",
              },
              user: {
                id: validUserId,
                email: "passenger@example.com",
                user_metadata: {
                  name: "Carlos Passenger",
                },
              },
            },
            error: null,
          }),
        },
      });

      userRepository.findUserById.mockResolvedValue({
        id: validUserId,
        email: "passenger@example.com",
        role: "Passenger",
        name: "Carlos Passenger",
      });

      userRoleRepository.findRoleByUserId.mockResolvedValue({
        id: "role-id",
        user_id: validUserId,
        role: "Passenger",
      });

      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(null);

      await expect(
        authService.loginDriver({
          email: "passenger@example.com",
          password: "Password123",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.FORBIDDEN_ROLE,
      });

      expect(userRoleRepository.findRoleByUserIdAndRole).toHaveBeenCalledWith(
        validUserId,
        "Driver",
      );

      expect(authAuditRepository.createLoginAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: validUserId,
          email: "passenger@example.com",
          auth_strategy: "password",
          was_successful: false,
          failure_code: ERROR_CODES.FORBIDDEN_ROLE,
        }),
      );
    });
  });
});
