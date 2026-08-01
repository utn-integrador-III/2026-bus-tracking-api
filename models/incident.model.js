"use strict";

const { z } = require("zod");

const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);

const tripId = z.string().uuid();
const incidentType = z.enum(["Delay", "Accident", "Overcrowding", "Other"]);
const description = z.string().trim().max(500).optional();

const createPassengerIncidentSchema = z
  .object({
    trip_id: tripId,
    type: incidentType,
    description,
    latitude,
    longitude,
  })
  .strict();

const createDriverIncidentSchema = z
  .object({
    trip_id: tripId,
    type: incidentType,
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

const listMapIncidentsQuerySchema = z
  .object({
    trip_id: tripId,
    since: z.string().datetime().optional(),
  })
  .strict();

module.exports = {
  createPassengerIncidentSchema,
  createDriverIncidentSchema,
  listPassengerIncidentsQuerySchema,
  listMapIncidentsQuerySchema,
};