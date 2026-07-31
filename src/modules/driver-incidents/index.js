"use strict";

const express = require("express");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const requireRole = require("../../../middleware/requireRole");
const { ROLES } = require("../../../constants/roles");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const asyncHandler = require("../../../utils/asyncHandler");
const {
  createDriverIncidentSchema,
  listMapIncidentsQuerySchema,
} = require("../../../models/incident.model");
const SupabaseDriverIncidentRepository = require("./infrastructure/SupabaseDriverIncidentRepository");
const SupabasePassengerIncidentRepository = require("../passenger-incidents/infrastructure/SupabasePassengerIncidentRepository");

const driverRepository = new SupabaseDriverIncidentRepository();
const passengerRepository = new SupabasePassengerIncidentRepository();

function createDriverIncidentsRouter() {
  const router = express.Router();

  router.use(requireAuth);
  router.use(requireRole(ROLES.DRIVER));

  router.post(
    "/",
    validate(
      { body: createDriverIncidentSchema },
      ERROR_CODES.INCIDENT_VALIDATION_FAILED,
    ),
    asyncHandler(async (req, res) => {
      const row = await driverRepository.createDriverIncident({
        trip_id: req.valid.body.trip_id,
        user_id: req.auth.userId,
        type: req.valid.body.type,
        description: req.valid.body.description || null,
        latitude: req.valid.body.latitude,
        longitude: req.valid.body.longitude,
      });

      res.status(HTTP_STATUS.CREATED).json({
        incident_id: row.id,
        incident: row,
      });
    }),
  );

  return router;
}

function createMapIncidentsRouter() {
  const router = express.Router();

  router.get(
    "/",
    validate(
      { query: listMapIncidentsQuerySchema },
      ERROR_CODES.INCIDENT_VALIDATION_FAILED,
    ),
    asyncHandler(async (req, res) => {
      const since = req.valid.query.since
        ? new Date(req.valid.query.since).toISOString()
        : new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const rows = await passengerRepository.findIncidentsByTripIdSince(
        req.valid.query.trip_id,
        since,
      );

      res.status(HTTP_STATUS.OK).json(rows);
    }),
  );

  return router;
}

module.exports = {
  createDriverIncidentsRouter,
  createMapIncidentsRouter,
};
