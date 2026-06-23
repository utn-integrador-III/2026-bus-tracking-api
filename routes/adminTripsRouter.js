"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const {
  createTripSchema,
  updateTripSchema,
  idParamSchema,
} = require("../models/tripSchema");
const { ERROR_CODES } = require("../constants/errorCodes");
const controller = require("../controllers/tripsController");

const router = express.Router();

const validationCode = ERROR_CODES.TRIP_VALIDATION_FAILED;

router.get("/", controller.listAdminTrips);

router.post(
  "/",
  validate({ body: createTripSchema }, validationCode),
  controller.createTrip,
);

router.get(
  "/:id",
  validate({ params: idParamSchema }, validationCode),
  controller.getTrip,
);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateTripSchema }, validationCode),
  controller.updateTrip,
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }, validationCode),
  controller.deactivateTrip,
);

router.post(
  "/:id/reactivate",
  validate({ params: idParamSchema }, validationCode),
  controller.reactivateTrip,
);

module.exports = router;
