"use strict";

const { z } = require("zod");

const reportLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    speed: z.number().min(0).optional(),
    heading: z.number().min(0).max(360).optional(),
    recorded_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

module.exports = {
  reportLocationSchema,
};
