"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const controller = require("../controllers/googleRoutesController");
const { computeGoogleRouteSchema } = require("../models/googleRoutes.model");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

router.post(
  "/compute",
  validate({ body: computeGoogleRouteSchema }, ERROR_CODES.GOOGLE_ROUTES_VALIDATION_FAILED),
  controller.computeRoute,
);

module.exports = router;