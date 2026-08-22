"use strict";

const {
  upsertPushDeviceSchema,
  notificationPreferencesSchema,
  tripSubscriptionSchema,
  listNotificationsQuerySchema,
} = require("../notification.model");

describe("notification schemas", () => {
  test("accepts current and legacy FCM targets", () => {
    expect(upsertPushDeviceSchema.safeParse({
      target_type: "fid",
      target_value: "firebase-installation-id-value",
      platform: "android",
    }).success).toBe(true);
    expect(upsertPushDeviceSchema.safeParse({
      target_type: "registration_token",
      target_value: "legacy-registration-token-value",
      platform: "ios",
    }).success).toBe(true);
  });

  test("requires at least one notification preference", () => {
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ cancellation: false }).success).toBe(true);
  });

  test("bounds the geofence preference", () => {
    expect(tripSubscriptionSchema.safeParse({ alert_radius_meters: 49 }).success).toBe(false);
    expect(tripSubscriptionSchema.safeParse({ alert_radius_meters: 500 }).success).toBe(true);
  });

  test("coerces pagination and boolean query values", () => {
    expect(listNotificationsQuerySchema.parse({})).toEqual({
      limit: 25,
      page: 1,
      unread_only: false,
    });
    expect(listNotificationsQuerySchema.parse({
      limit: "50",
      page: "2",
      unread_only: "true",
    })).toEqual({ limit: 50, page: 2, unread_only: true });
  });
});
