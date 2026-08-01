"use strict";

const { z } = require("zod");
const { REPORT_TYPE_VALUES } = require("../constants/reportType");

function normalizeReportType(value) {
  if (typeof value !== "string") {
    return value;
  }

  const candidate = value.trim().toLowerCase();
  const match = REPORT_TYPE_VALUES.find((option) => option.toLowerCase() === candidate);

  return match === undefined ? value.trim() : match;
}

const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);

const tripId = z.string().uuid();
const type = z.preprocess(normalizeReportType, z.enum(REPORT_TYPE_VALUES));
const description = z.string().trim().min(1).max(500);

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
  normalizeReportType,
};
