"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const controller = require("../controllers/passengerController");
const { listMapIncidentsQuerySchema } = require("../models/incident.model");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

router.get(
  "/",
  validate({ query: listMapIncidentsQuerySchema }, ERROR_CODES.INCIDENT_VALIDATION_FAILED),
  controller.listMapIncidents,
);

module.exports = router;
