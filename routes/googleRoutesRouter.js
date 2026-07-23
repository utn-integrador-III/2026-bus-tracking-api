"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const controller = require("../controllers/googleRoutesController");
const { computeGoogleRouteSchema } = require("../models/googleRoutes.model");
const { ERROR_CODES } = require("../constants/errorCodes");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.post(
  "/compute",
  validate({ body: computeGoogleRouteSchema }, ERROR_CODES.GOOGLE_ROUTES_VALIDATION_FAILED),
  controller.computeRoute,
);

module.exports = router;