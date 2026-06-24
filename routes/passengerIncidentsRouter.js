"use strict";

const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const controller = require("../controllers/passengerController");
const {
  createPassengerIncidentSchema,
  listPassengerIncidentsQuerySchema,
} = require("../models/incident.model");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

router.use(requireAuth);

router.post(
  "/",
  validate({ body: createPassengerIncidentSchema }, ERROR_CODES.INCIDENT_VALIDATION_FAILED),
  controller.createPassengerIncident,
);

router.get(
  "/",
  validate({ query: listPassengerIncidentsQuerySchema }, ERROR_CODES.INCIDENT_VALIDATION_FAILED),
  controller.listPassengerIncidents,
);

module.exports = router;