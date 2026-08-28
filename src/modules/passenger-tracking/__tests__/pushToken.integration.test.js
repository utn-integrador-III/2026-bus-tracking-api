"use strict";

jest.mock("../../../../database/supabaseClient", () => ({
  verifyAccessToken: jest.fn(),
  getServiceClient: jest.fn(),
  getAnonClient: jest.fn(),
}));
jest.mock("../../../../repositories/passengerRepository", () => ({
  updatePassengerProfile: jest.fn(),
  createPassengerProfile: jest.fn(),
  findPassengerById: jest.fn(),
}));

const request = require("supertest");
const { verifyAccessToken } = require("../../../../database/supabaseClient");
const passengerRepository = require("../../../../repositories/passengerRepository");
const buildApp = require("../../../../app");

const app = buildApp();
const AUTH_TOKEN = "test-token";
const TOKEN = "ExponentPushToken[abcdef123456]";
const passengerUser = { id: "passenger-user-id", user_metadata: { role: "Passenger" } };

describe("POST /api/passenger/push-token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockResolvedValue(passengerUser);
  });

  test("registers the Expo push token for the authenticated passenger", async () => {
    passengerRepository.updatePassengerProfile.mockResolvedValue({
      user_id: "passenger-user-id",
      expo_push_token: TOKEN,
    });

    const response = await request(app)
      .post("/api/passenger/push-token")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send({ expo_push_token: TOKEN });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user_id: "passenger-user-id",
      expo_push_token: TOKEN,
    });
    expect(passengerRepository.updatePassengerProfile).toHaveBeenCalledWith("passenger-user-id", {
      expo_push_token: TOKEN,
    });
  });

  test("creates the passenger profile when the user has none yet", async () => {
    passengerRepository.updatePassengerProfile.mockResolvedValue(null);
    passengerRepository.createPassengerProfile.mockResolvedValue({
      user_id: "passenger-user-id",
      expo_push_token: TOKEN,
    });

    const response = await request(app)
      .post("/api/passenger/push-token")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send({ expo_push_token: TOKEN });

    expect(response.status).toBe(200);
    expect(passengerRepository.createPassengerProfile).toHaveBeenCalledWith({
      user_id: "passenger-user-id",
      expo_push_token: TOKEN,
    });
  });

  test("rejects a token that is not an Expo push token", async () => {
    const response = await request(app)
      .post("/api/passenger/push-token")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send({ expo_push_token: "fcm-registration-token" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("PUSH_TOKEN_VALIDATION_FAILED");
    expect(passengerRepository.updatePassengerProfile).not.toHaveBeenCalled();
  });

  test("rejects an unknown body field", async () => {
    const response = await request(app)
      .post("/api/passenger/push-token")
      .set("Authorization", `Bearer ${AUTH_TOKEN}`)
      .send({ fcm_token: TOKEN });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("PUSH_TOKEN_VALIDATION_FAILED");
  });

  test("requires authentication", async () => {
    const response = await request(app)
      .post("/api/passenger/push-token")
      .send({ expo_push_token: TOKEN });

    expect(response.status).toBe(401);
  });
});
