"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const controller = require("../controllers/driverController");
const {
  createDriverSchema,
  updateDriverSchema,
  idParamSchema,
} = require("../models/driver.model");
const { ERROR_CODES } = require("../constants/errorCodes");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get("/", controller.listDrivers);

router.post(
  "/",
  validate({ body: createDriverSchema }, ERROR_CODES.DRIVER_VALIDATION_FAILED),
  controller.createDriver,
);

router.get(
  "/:id",
  validate({ params: idParamSchema }, ERROR_CODES.DRIVER_VALIDATION_FAILED),
  controller.getDriver,
);

router.put(
  "/:id",
  validate(
    { params: idParamSchema, body: updateDriverSchema },
    ERROR_CODES.DRIVER_VALIDATION_FAILED,
  ),
  controller.updateDriver,
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }, ERROR_CODES.DRIVER_VALIDATION_FAILED),
  controller.deactivateDriver,
);

module.exports = router;