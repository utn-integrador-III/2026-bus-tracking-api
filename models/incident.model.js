"use strict";

const { z } = require("zod");

const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);

const tripId = z.string().uuid();
const type = z.string().trim().min(1).max(80);
const description = z.string().trim().max(500).optional();

const createPassengerIncidentSchema = z
  .object({
    trip_id: tripId,
    type,
    description,
    latitude,
    longitude,
  })
  .strict();

const listPassengerIncidentsQuerySchema = z
  .object({
    trip_id: tripId,
  })
  .strict();

module.exports = {
  createPassengerIncidentSchema,
  listPassengerIncidentsQuerySchema,
};