"use strict";

const { z } = require("zod");

const idParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

const stopSchema = z
  .object({
    id: z.string().uuid().optional(),
    route_id: z.string().uuid(),
    name: z.string().trim().min(1).max(255),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    stop_order: z.number().int().nonnegative(),
    geofence_radius_meters: z.number().int().positive().default(500),
  })
  .strict();

module.exports = {
  stopSchema,
  idParamSchema,
};
