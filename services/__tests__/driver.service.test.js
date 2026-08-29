"use strict";

jest.mock("../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
}));

jest.mock("../../repositories/userRepository", () => ({
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  setUserActive: jest.fn(),
}));

jest.mock("../../repositories/userRoleRepository", () => ({
  listRolesByRole: jest.fn(),
  findRoleByUserIdAndRole: jest.fn(),
  createUserRole: jest.fn(),
  updateRoleByUserIdAndRole: jest.fn(),
}));

const { getServiceClient } = require("../../database/supabaseClient");
const userRepository = require("../../repositories/userRepository");
const userRoleRepository = require("../../repositories/userRoleRepository");
const driverService = require("../driver.service");
const { ERROR_CODES } = require("../../constants/errorCodes");

const validUserId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const userRow = {
  id: validUserId,
  name: "Carlos Gomez",
  email: "driver@example.com",
  is_active: true,
  deactivated_at: null,
  created_at: "2026-06-20T10:00:00Z",
};

const driverRoleRow = {
  id: "role-id",
  user_id: validUserId,
  role: "Driver",
  license_number: "B1-123456",
  employee_code: null,
  assigned_at: "2026-06-20T10:00:00Z",
};

describe("driver.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listDrivers", () => {
    test("lists all drivers", async () => {
      userRoleRepository.listRolesByRole.mockResolvedValue([driverRoleRow]);
      userRepository.findUserById.mockResolvedValue(userRow);

      const result = await driverService.listDrivers();

      expect(userRoleRepository.listRolesByRole).toHaveBeenCalledWith("Driver");
      expect(userRepository.findUserById).toHaveBeenCalledWith(validUserId);

      expect(result).toEqual([
        {
          user_id: validUserId,
          name: "Carlos Gomez",
          email: "driver@example.com",
          role: "Driver",
          license_number: "B1-123456",
          is_active: true,
          deactivated_at: null,
          created_at: "2026-06-20T10:00:00Z",
        },
      ]);
    });

    test("ignores role records without an existing user", async () => {
      userRoleRepository.listRolesByRole.mockResolvedValue([driverRoleRow]);
      userRepository.findUserById.mockResolvedValue(null);

      const result = await driverService.listDrivers();

      expect(result).toEqual([]);
    });
  });

  describe("getDriverById", () => {
    test("gets a driver by id", async () => {
      userRepository.findUserById.mockResolvedValue(userRow);
      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(driverRoleRow);

      const result = await driverService.getDriverById(validUserId);

      expect(userRepository.findUserById).toHaveBeenCalledWith(validUserId);
      expect(userRoleRepository.findRoleByUserIdAndRole).toHaveBeenCalledWith(
        validUserId,
        "Driver",
      );

      expect(result.user_id).toBe(validUserId);
      expect(result.role).toBe("Driver");
      expect(result.license_number).toBe("B1-123456");
    });

    test("throws not found when user does not exist", async () => {
      userRepository.findUserById.mockResolvedValue(null);

      await expect(driverService.getDriverById(validUserId)).rejects.toMatchObject({
        code: ERROR_CODES.DRIVER_NOT_FOUND,
      });
    });

    test("throws not found when driver role does not exist", async () => {
      userRepository.findUserById.mockResolvedValue(userRow);
      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(null);

      await expect(driverService.getDriverById(validUserId)).rejects.toMatchObject({
        code: ERROR_CODES.DRIVER_NOT_FOUND,
      });
    });
  });

  describe("createDriver", () => {
    test("creates a driver successfully", async () => {
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

      userRepository.createUserProfile.mockResolvedValue(userRow);
      userRoleRepository.createUserRole.mockResolvedValue(driverRoleRow);

      const result = await driverService.createDriver({
        name: "Carlos Gomez",
        email: "driver@example.com",
        password: "Password123",
        license_number: "B1-123456",
      });

      expect(userRepository.findUserByEmail).toHaveBeenCalledWith("driver@example.com");

      expect(createUserMock).toHaveBeenCalledWith({
        email: "driver@example.com",
        password: "Password123",
        email_confirm: true,
        user_metadata: {
          name: "Carlos Gomez",
          role: "Driver",
        },
      });

      expect(userRepository.createUserProfile).toHaveBeenCalledWith({
        id: validUserId,
        name: "Carlos Gomez",
        email: "driver@example.com",
        is_active: true,
      });

      expect(userRoleRepository.createUserRole).toHaveBeenCalledWith({
        user_id: validUserId,
        role: "Driver",
        license_number: "B1-123456",
      });

      expect(result.role).toBe("Driver");
      expect(result.license_number).toBe("B1-123456");
    });

    test("rejects driver creation when email already exists", async () => {
      userRepository.findUserByEmail.mockResolvedValue(userRow);

      await expect(
        driverService.createDriver({
          name: "Carlos Gomez",
          email: "driver@example.com",
          password: "Password123",
          license_number: "B1-123456",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_EMAIL_EXISTS,
      });

      expect(getServiceClient).not.toHaveBeenCalled();
      expect(userRepository.createUserProfile).not.toHaveBeenCalled();
      expect(userRoleRepository.createUserRole).not.toHaveBeenCalled();
    });

    test("throws an error when Supabase Auth cannot create the driver", async () => {
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
        driverService.createDriver({
          name: "Carlos Gomez",
          email: "driver@example.com",
          password: "Password123",
          license_number: "B1-123456",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.DRIVER_CREATE_FAILED,
      });

      expect(userRepository.createUserProfile).not.toHaveBeenCalled();
      expect(userRoleRepository.createUserRole).not.toHaveBeenCalled();
    });
  });

  describe("updateDriver", () => {
    test("updates a driver successfully", async () => {
      const updateUserByIdMock = jest.fn().mockResolvedValue({ error: null });

      getServiceClient.mockReturnValue({
        auth: {
          admin: {
            updateUserById: updateUserByIdMock,
          },
        },
      });

      userRepository.findUserById.mockResolvedValue(userRow);
      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(driverRoleRow);

      userRepository.updateUserProfile.mockResolvedValue({
        ...userRow,
        name: "Updated Driver",
      });

      userRoleRepository.updateRoleByUserIdAndRole.mockResolvedValue({
        ...driverRoleRow,
        license_number: "B2-999999",
      });

      const result = await driverService.updateDriver(validUserId, {
        name: "Updated Driver",
        license_number: "B2-999999",
      });

      expect(updateUserByIdMock).toHaveBeenCalledWith(validUserId, {
        user_metadata: {
          name: "Updated Driver",
          role: "Driver",
        },
      });

      expect(userRepository.updateUserProfile).toHaveBeenCalledWith(validUserId, {
        name: "Updated Driver",
      });

      expect(userRoleRepository.updateRoleByUserIdAndRole).toHaveBeenCalledWith(
        validUserId,
        "Driver",
        {
          license_number: "B2-999999",
        },
      );

      expect(result.user_id).toBe(validUserId);
    });

    test("rejects update when email already belongs to another user", async () => {
      userRepository.findUserById.mockResolvedValue(userRow);
      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(driverRoleRow);

      userRepository.findUserByEmail.mockResolvedValue({
        id: "another-user-id",
        email: "other@example.com",
      });

      await expect(
        driverService.updateDriver(validUserId, {
          email: "other@example.com",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.AUTH_EMAIL_EXISTS,
      });
    });

    test("throws update error when Supabase Auth update fails", async () => {
      getServiceClient.mockReturnValue({
        auth: {
          admin: {
            updateUserById: jest.fn().mockResolvedValue({
              error: {
                message: "Supabase update failed",
              },
            }),
          },
        },
      });

      userRepository.findUserById.mockResolvedValue(userRow);
      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(driverRoleRow);

      await expect(
        driverService.updateDriver(validUserId, {
          name: "Updated Driver",
        }),
      ).rejects.toMatchObject({
        code: ERROR_CODES.DRIVER_UPDATE_FAILED,
      });
    });
  });

  describe("deactivateDriver", () => {
    test("deactivates a driver successfully", async () => {
      const inactiveUser = {
        ...userRow,
        is_active: false,
        deactivated_at: "2026-06-20T11:00:00Z",
      };

      userRepository.findUserById.mockResolvedValue(userRow);
      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(driverRoleRow);
      userRepository.setUserActive.mockResolvedValue(inactiveUser);

      const result = await driverService.deactivateDriver(validUserId);

      expect(userRepository.setUserActive).toHaveBeenCalledWith(validUserId, false);
      expect(result.is_active).toBe(false);
    });
  });

  describe("reactivateDriver", () => {
    test("reactivates a driver successfully", async () => {
      const reactivatedUser = {
        ...userRow,
        is_active: true,
        deactivated_at: null,
      };

      userRepository.findUserById.mockResolvedValue({
        ...userRow,
        is_active: false,
      });
      userRoleRepository.findRoleByUserIdAndRole.mockResolvedValue(driverRoleRow);
      userRepository.setUserActive.mockResolvedValue(reactivatedUser);

      const result = await driverService.reactivateDriver(validUserId);

      expect(userRepository.setUserActive).toHaveBeenCalledWith(validUserId, true);
      expect(result.is_active).toBe(true);
    });
  });
});