"use strict";

const { z } = require("zod");
const { TRIP_STATUS_VALUES } = require("../constants/tripStatus");

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const status = z.enum(TRIP_STATUS_VALUES);

const createTripSchema = z
  .object({
    route_id: uuid,
    bus_id: uuid,
    driver_id: uuid,
    departure_time: timestamp,
    arrival_time: timestamp.nullable().optional(),
    status: status.optional(),
  })
  .strict();

const updateTripSchema = z
  .object({
    route_id: uuid,
    bus_id: uuid,
    driver_id: uuid,
    departure_time: timestamp,
    arrival_time: timestamp.nullable(),
    status,
    status_reason: z.string().trim().min(1).max(500).nullable(),
    status_metadata: z.record(z.string(), z.unknown()),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar.",
  });

const idParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

module.exports = {
  createTripSchema,
  updateTripSchema,
  idParamSchema,
};
