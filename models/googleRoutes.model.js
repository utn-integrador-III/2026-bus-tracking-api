"use strict";

const { z } = require("zod");

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const latLngSchema = z
  .object({
    latitude,
    longitude,
  })
  .strict();

const computeGoogleRouteSchema = z
  .object({
    origin: latLngSchema,
    destination: latLngSchema,
  })
  .strict();

module.exports = {
  computeGoogleRouteSchema,
};