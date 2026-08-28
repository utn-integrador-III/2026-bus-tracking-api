"use strict";

const { z } = require("zod");
const { geoJsonRouteGeometrySchema } = require("./routeSchema");

const reason = z.string().trim().min(1).max(500);

const reportLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    speed: z.number().min(0).optional(),
    heading: z.number().min(0).max(360).optional(),
    recorded_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const delayTripSchema = z
  .object({
    reason,
    estimated_delay_minutes: z.number().int().min(1).max(1440).optional(),
  })
  .strict();

const cancelTripSchema = z.preprocess(
  (value) => value === undefined ? {} : value,
  z
    .object({
      reason: reason.optional(),
    })
    .strict(),
);

const reportDetourSchema = z
  .object({
    reason,
    geometry_geojson: geoJsonRouteGeometrySchema.optional(),
    affected_stop_ids: z.array(z.string().uuid()).max(50).optional(),
    expected_end_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

module.exports = {
  reportLocationSchema,
  delayTripSchema,
  cancelTripSchema,
  reportDetourSchema,
};
