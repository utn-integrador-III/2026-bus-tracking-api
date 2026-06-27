"use strict";

jest.mock("../../repositories/seniorVerificationRepository", () => ({
  listRequests: jest.fn(),
  findRequestById: jest.fn(),
  updateRequest: jest.fn(),
  reviewRequest: jest.fn(),
}));

jest.mock("../../repositories/passengerRepository", () => ({
  findPassengerById: jest.fn(),
  updatePassengerProfile: jest.fn(),
}));

jest.mock("../../repositories/userRepository", () => ({
  findUserById: jest.fn(),
  setUserActive: jest.fn(),
}));

const seniorVerificationService = require("../seniorVerification.service");
const seniorVerificationRepository = require("../../repositories/seniorVerificationRepository");
const passengerRepository = require("../../repositories/passengerRepository");
const userRepository = require("../../repositories/userRepository");
const { ERROR_CODES } = require("../../constants/errorCodes");

const requestId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const passengerId = "4f2504e0-4f89-41d3-9a0c-0305e82c3302";
const adminId = "5f2504e0-4f89-41d3-9a0c-0305e82c3303";

const pendingRequest = {
  id: requestId,
  passenger_id: passengerId,
  document_image_bucket: "cedulas",
  document_image_path: "passengers/senior.passenger@example.com/cedula.jpg",
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: "2026-06-20T10:00:00Z",
  updated_at: "2026-06-20T10:00:00Z",
};

const user = {
  id: passengerId,
  name: "Senior Passenger",
  email: "senior.passenger@example.com",
  is_active: false,
  deactivated_at: null,
  created_at: "2026-06-20T10:00:00Z",
};

const passenger = {
  user_id: passengerId,
  phone: "88882222",
  notification_preferences: null,
  is_senior: false,
  expo_push_token: null,
  birth_date: "1960-05-10",
  senior_status: "not_applicable",
};

describe("seniorVerification.service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("lists senior verification requests", async () => {
    seniorVerificationRepository.listRequests.mockResolvedValue([pendingRequest]);
    userRepository.findUserById.mockResolvedValue(user);
    passengerRepository.findPassengerById.mockResolvedValue(passenger);

    const result = await seniorVerificationService.listRequests({
      status: "pending",
    });

    expect(seniorVerificationRepository.listRequests).toHaveBeenCalledWith({
      status: "pending",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(requestId);
    expect(result[0].user.email).toBe("senior.passenger@example.com");
    expect(result[0].passenger.user_id).toBe(passengerId);
  });

  test("gets a senior verification request by id", async () => {
    seniorVerificationRepository.findRequestById.mockResolvedValue(pendingRequest);
    userRepository.findUserById.mockResolvedValue(user);
    passengerRepository.findPassengerById.mockResolvedValue(passenger);

    const result = await seniorVerificationService.getRequestById(requestId);

    expect(seniorVerificationRepository.findRequestById).toHaveBeenCalledWith(requestId);
    expect(result.id).toBe(requestId);
    expect(result.status).toBe("pending");
  });

  test("throws not found when request does not exist", async () => {
    seniorVerificationRepository.findRequestById.mockResolvedValue(null);

    await expect(
      seniorVerificationService.getRequestById(requestId),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SENIOR_VERIFICATION_NOT_FOUND,
    });
  });

  test("approves a pending senior verification request", async () => {
        const approvedRequest = {
            ...pendingRequest,
            status: "approved",
            reviewed_by: adminId,
            reviewed_at: "2026-06-20T11:00:00Z",
            rejection_reason: null,
        };

        seniorVerificationRepository.findRequestById
            .mockResolvedValueOnce(pendingRequest)
            .mockResolvedValueOnce(approvedRequest);

        seniorVerificationRepository.reviewRequest.mockResolvedValue(approvedRequest);

        userRepository.findUserById.mockResolvedValue({
            ...user,
            is_active: true,
        });

        passengerRepository.findPassengerById.mockResolvedValue({
            ...passenger,
            is_senior: true,
            senior_status: "approved",
        });

        const result = await seniorVerificationService.approveRequest(requestId, {
            reviewed_by: adminId,
        });

        expect(seniorVerificationRepository.findRequestById).toHaveBeenCalledWith(
            requestId,
        );

        expect(seniorVerificationRepository.reviewRequest).toHaveBeenCalledWith({
            request_id: requestId,
            action: "approved",
            reviewed_by: adminId,
            rejection_reason: null,
        });

        expect(result.status).toBe("approved");
        expect(result.passenger.is_senior).toBe(true);
        expect(result.passenger.senior_status).toBe("approved");
        expect(result.user.is_active).toBe(true);
    });

  test("rejects a pending senior verification request", async () => {
    const rejectedRequest = {
        ...pendingRequest,
        status: "rejected",
        reviewed_by: adminId,
        reviewed_at: "2026-06-20T11:00:00Z",
        rejection_reason: "The uploaded document is not readable.",
    };

    seniorVerificationRepository.findRequestById
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(rejectedRequest);

    seniorVerificationRepository.reviewRequest.mockResolvedValue(rejectedRequest);

    userRepository.findUserById.mockResolvedValue({
        ...user,
        is_active: false,
    });

    passengerRepository.findPassengerById.mockResolvedValue({
        ...passenger,
        is_senior: false,
        senior_status: "rejected",
    });

    const result = await seniorVerificationService.rejectRequest(requestId, {
        reviewed_by: adminId,
        rejection_reason: "The uploaded document is not readable.",
    });

    expect(seniorVerificationRepository.findRequestById).toHaveBeenCalledWith(
        requestId,
    );

    expect(seniorVerificationRepository.reviewRequest).toHaveBeenCalledWith({
        request_id: requestId,
        action: "rejected",
        reviewed_by: adminId,
        rejection_reason: "The uploaded document is not readable.",
    });

    expect(result.status).toBe("rejected");
    expect(result.passenger.is_senior).toBe(false);
    expect(result.passenger.senior_status).toBe("rejected");
    expect(result.user.is_active).toBe(false);
    });

  test("does not approve a request that was already reviewed", async () => {
    seniorVerificationRepository.findRequestById.mockResolvedValue({
      ...pendingRequest,
      status: "approved",
    });

    await expect(
      seniorVerificationService.approveRequest(requestId, {}),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SENIOR_VERIFICATION_ALREADY_REVIEWED,
    });
  });

  test("does not reject a request that was already reviewed", async () => {
    seniorVerificationRepository.findRequestById.mockResolvedValue({
      ...pendingRequest,
      status: "approved",
    });

    await expect(
      seniorVerificationService.rejectRequest(requestId, {
        rejection_reason: "Invalid request.",
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SENIOR_VERIFICATION_ALREADY_REVIEWED,
    });
  });
});