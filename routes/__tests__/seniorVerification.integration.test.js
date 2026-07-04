"use strict";

const request = require("supertest");
const buildApp = require("../../app");
const seniorVerificationService = require("../../services/seniorVerification.service");
const { verifyAccessToken } = require("../../database/supabaseClient");

jest.mock("../../services/seniorVerification.service", () => ({
  listRequests: jest.fn(),
  getRequestById: jest.fn(),
  approveRequest: jest.fn(),
  rejectRequest: jest.fn(),
}));

jest.mock("../../database/supabaseClient", () => ({
  verifyAccessToken: jest.fn(),
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));

const app = buildApp();

const AUTH_HEADER = "Bearer admin-token";
const adminUser = { id: "admin-user-id", app_metadata: { role: "Admin" } };
const passengerUser = { id: "passenger-user-id", app_metadata: { role: "Passenger" } };
const requestId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const seniorRequest = {
  id: requestId,
  passenger_id: "4f2504e0-4f89-41d3-9a0c-0305e82c3302",
  document_image_bucket: "cedulas",
  document_image_path: "passengers/senior.passenger@example.com/cedula.jpg",
  status: "pending",
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: "2026-06-20T10:00:00Z",
  updated_at: "2026-06-20T10:00:00Z",
};

describe("admin senior verification routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue(adminUser);
  });

  test("GET /api/admin/senior-requests returns requests", async () => {
    seniorVerificationService.listRequests.mockResolvedValue([seniorRequest]);

    const response = await request(app)
      .get("/api/admin/senior-requests?status=pending")
      .set("Authorization", AUTH_HEADER)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(requestId);
    expect(seniorVerificationService.listRequests).toHaveBeenCalledWith({
      status: "pending",
    });
  });

  test("GET /api/admin/senior-requests rejects invalid status", async () => {
    await request(app)
      .get("/api/admin/senior-requests?status=invalid")
      .set("Authorization", AUTH_HEADER)
      .expect(400);

    expect(seniorVerificationService.listRequests).not.toHaveBeenCalled();
  });

  test("GET /api/admin/senior-requests/:id returns one request", async () => {
    seniorVerificationService.getRequestById.mockResolvedValue(seniorRequest);

    const response = await request(app)
      .get(`/api/admin/senior-requests/${requestId}`)
      .set("Authorization", AUTH_HEADER)
      .expect(200);

    expect(response.body.id).toBe(requestId);
    expect(seniorVerificationService.getRequestById).toHaveBeenCalledWith(requestId);
  });

  test("PATCH /api/admin/senior-requests/:id/approve approves request", async () => {
    seniorVerificationService.approveRequest.mockResolvedValue({
      ...seniorRequest,
      status: "approved",
    });

    const response = await request(app)
      .patch(`/api/admin/senior-requests/${requestId}/approve`)
      .set("Authorization", AUTH_HEADER)
      .send({})
      .expect(200);

    expect(response.body.status).toBe("approved");
    expect(seniorVerificationService.approveRequest).toHaveBeenCalledWith(
      requestId,
      {},
    );
  });

  test("PATCH /api/admin/senior-requests/:id/reject rejects request", async () => {
    seniorVerificationService.rejectRequest.mockResolvedValue({
      ...seniorRequest,
      status: "rejected",
      rejection_reason: "The uploaded document is not readable.",
    });

    const response = await request(app)
      .patch(`/api/admin/senior-requests/${requestId}/reject`)
      .set("Authorization", AUTH_HEADER)
      .send({
        rejection_reason: "The uploaded document is not readable.",
      })
      .expect(200);

    expect(response.body.status).toBe("rejected");
    expect(response.body.rejection_reason).toBe(
      "The uploaded document is not readable.",
    );
    expect(seniorVerificationService.rejectRequest).toHaveBeenCalledWith(
      requestId,
      {
        rejection_reason: "The uploaded document is not readable.",
      },
    );
  });

  test("PATCH /api/admin/senior-requests/:id/reject requires rejection reason", async () => {
    await request(app)
      .patch(`/api/admin/senior-requests/${requestId}/reject`)
      .set("Authorization", AUTH_HEADER)
      .send({})
      .expect(400);

    expect(seniorVerificationService.rejectRequest).not.toHaveBeenCalled();
  });

  test("rejects unauthenticated access to senior requests", async () => {
    await request(app).get("/api/admin/senior-requests").expect(401);

    expect(seniorVerificationService.listRequests).not.toHaveBeenCalled();
  });

  test("rejects non-admin roles", async () => {
    verifyAccessToken.mockResolvedValue(passengerUser);

    await request(app)
      .get("/api/admin/senior-requests")
      .set("Authorization", "Bearer passenger-token")
      .expect(403);

    expect(seniorVerificationService.listRequests).not.toHaveBeenCalled();
  });
});