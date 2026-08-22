"use strict";

const { NotificationService } = require("../index");
const { ERROR_CODES } = require("../../../../constants/errorCodes");

const USER_ID = "user-1";
const TRIP_ID = "trip-1";
const STOP_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const STOP_B = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

function buildRepository(overrides = {}) {
  return {
    upsertPushDevice: jest.fn().mockResolvedValue({ id: "device-1" }),
    deactivatePushDevice: jest.fn().mockResolvedValue({ id: "device-1" }),
    getNotificationPreferences: jest.fn().mockResolvedValue({ push_enabled: true, delay: true }),
    updateNotificationPreferences: jest.fn().mockResolvedValue({ push_enabled: true }),
    findStopsByIds: jest.fn().mockResolvedValue([
      { id: STOP_A, route_id: "route-1" },
      { id: STOP_B, route_id: "route-1" },
    ]),
    upsertTripSubscription: jest.fn().mockResolvedValue({ id: "subscription-1" }),
    exitTripSubscription: jest.fn().mockResolvedValue({ id: "subscription-1" }),
    listNotifications: jest.fn().mockResolvedValue([]),
    markNotificationRead: jest.fn().mockResolvedValue({ id: "notification-1", status: "Read" }),
    ...overrides,
  };
}

function buildService(repository = buildRepository(), tripOverrides = {}) {
  return new NotificationService({
    repository,
    tripRepository: {
      getTripById: jest.fn().mockResolvedValue({
        id: TRIP_ID,
        route_id: "route-1",
        status: "In_Progress",
        ...tripOverrides,
      }),
    },
  });
}

describe("NotificationService", () => {
  test("registers a user-owned installation", async () => {
    const repository = buildRepository();
    const service = buildService(repository);
    const payload = {
      target_type: "fid",
      target_value: "firebase-installation-id-value",
      platform: "android",
    };

    await service.registerDevice(USER_ID, "installation-1", payload);

    expect(repository.upsertPushDevice).toHaveBeenCalledWith(USER_ID, "installation-1", payload);
  });

  test("merges a partial preferences update", async () => {
    const repository = buildRepository();
    const service = buildService(repository);

    await service.updatePreferences(USER_ID, { delay: false });

    expect(repository.updateNotificationPreferences).toHaveBeenCalledWith(USER_ID, {
      push_enabled: true,
      delay: false,
    });
  });

  test("subscribes only when both stops belong to the trip route", async () => {
    const repository = buildRepository();
    const service = buildService(repository);
    const payload = { boarding_stop_id: STOP_A, destination_stop_id: STOP_B };

    await service.subscribeToTrip(USER_ID, TRIP_ID, payload);

    expect(repository.upsertTripSubscription).toHaveBeenCalledWith(USER_ID, TRIP_ID, payload);
  });

  test("rejects stops from another route", async () => {
    const repository = buildRepository({
      findStopsByIds: jest.fn().mockResolvedValue([{ id: STOP_A, route_id: "other-route" }]),
    });
    const service = buildService(repository);

    await expect(
      service.subscribeToTrip(USER_ID, TRIP_ID, { boarding_stop_id: STOP_A }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: ERROR_CODES.TRIP_SUBSCRIPTION_VALIDATION_FAILED,
    });
  });

  test("rejects subscriptions to completed trips", async () => {
    const service = buildService(buildRepository(), { status: "Completed" });

    await expect(service.subscribeToTrip(USER_ID, TRIP_ID, {})).rejects.toMatchObject({
      statusCode: 400,
      code: ERROR_CODES.TRIP_SUBSCRIPTION_VALIDATION_FAILED,
    });
  });

  test("rejects an unsubscribe when no subscription exists", async () => {
    const repository = buildRepository({ exitTripSubscription: jest.fn().mockResolvedValue(null) });
    const service = buildService(repository);

    await expect(service.unsubscribeFromTrip(USER_ID, TRIP_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: ERROR_CODES.TRIP_SUBSCRIPTION_NOT_FOUND,
    });
  });

  test("marks only a user-owned notification as read", async () => {
    const repository = buildRepository();
    const service = buildService(repository);

    await service.markRead(USER_ID, "notification-1");

    expect(repository.markNotificationRead).toHaveBeenCalledWith(USER_ID, "notification-1");
  });
});
