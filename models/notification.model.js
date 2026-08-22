"use strict";

const { z } = require("zod");

const uuid = z.string().uuid();

const installationIdParamSchema = z
  .object({
    installationId: uuid,
  })
  .strict();

const notificationIdParamSchema = z
  .object({
    id: uuid,
  })
  .strict();

const upsertPushDeviceSchema = z
  .object({
    target_type: z.enum(["fid", "registration_token"]),
    target_value: z.string().trim().min(20).max(4096),
    platform: z.enum(["android", "ios", "web"]),
    app_version: z.string().trim().min(1).max(50).optional(),
  })
  .strict();

const notificationPreferencesSchema = z
  .object({
    push_enabled: z.boolean().optional(),
    terminal_departure: z.boolean().optional(),
    delay: z.boolean().optional(),
    detour: z.boolean().optional(),
    cancellation: z.boolean().optional(),
    route_restored: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos una preferencia.",
  });

const tripSubscriptionSchema = z
  .object({
    boarding_stop_id: uuid.optional(),
    destination_stop_id: uuid.optional(),
    alert_radius_meters: z.number().int().min(50).max(5000).optional(),
  })
  .strict();

const listNotificationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).default(1),
    unread_only: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
  })
  .strict();

module.exports = {
  installationIdParamSchema,
  notificationIdParamSchema,
  upsertPushDeviceSchema,
  notificationPreferencesSchema,
  tripSubscriptionSchema,
  listNotificationsQuerySchema,
};
