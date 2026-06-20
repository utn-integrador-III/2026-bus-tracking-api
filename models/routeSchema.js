"use strict";

const { z } = require("zod");

const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);

const position = z.tuple([longitude, latitude]).rest(z.number());

const lineStringGeometry = z
  .object({
    type: z.literal("LineString"),
    coordinates: z.array(position).min(2),
  })
  .strict();

const lineStringFeature = z
  .object({
    type: z.literal("Feature"),
    geometry: lineStringGeometry,
    properties: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
  })
  .strict();

const geoJsonRouteGeometrySchema = z.union([lineStringGeometry, lineStringFeature]);

const name = z.string().trim().min(1).max(255);
const origin = z.string().trim().min(1).max(255);
const destination = z.string().trim().min(1).max(255);

const createRouteSchema = z
  .object({
    name,
    origin,
    destination,
    geometry_geojson: geoJsonRouteGeometrySchema,
  })
  .strict();

const updateRouteSchema = z
  .object({
    name,
    origin,
    destination,
    geometry_geojson: geoJsonRouteGeometrySchema,
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
  geoJsonRouteGeometrySchema,
  createRouteSchema,
  updateRouteSchema,
  idParamSchema,
};
