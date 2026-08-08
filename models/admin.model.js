"use strict";

const { z } = require("zod");
const {
  REPORT_MODERATION_STATUS_VALUES,
} = require("../constants/reportModerationStatus");

const idParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

const listStopsQuerySchema = z
  .object({
    route_id: z.string().uuid().optional(),
  })
  .strict();

const stopSchema = z
  .object({
    route_id: z.string().uuid(),
    name: z.string().trim().min(1).max(255),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    stop_order: z.number().int().nonnegative(),
    geofence_radius_meters: z.number().int().positive().default(500),
  })
  .strict();

const listIncidentsQuerySchema = z
  .object({
    status: z.enum(REPORT_MODERATION_STATUS_VALUES).optional(),
  })
  .strict();

const moderateIncidentSchema = z
  .object({
    moderation_status: z.enum(REPORT_MODERATION_STATUS_VALUES),
  })
  .strict();

const telemetryHistoryQuerySchema = z
  .object({
    trip_id: z.string().uuid(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
  })
  .strict();

const listUsersQuerySchema = z
  .object({
    role: z.enum(["Passenger", "Driver", "Admin"]).optional(),
  })
  .strict();

module.exports = {
  idParamSchema,
  listStopsQuerySchema,
  stopSchema,
  listIncidentsQuerySchema,
  moderateIncidentSchema,
  telemetryHistoryQuerySchema,
  listUsersQuerySchema,
};
