"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const controller = require("../controllers/authController");
const {
  registerPassengerSchema,
  loginSchema,
} = require("../models/auth.model");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

router.post(
  "/register",
  validate({ body: registerPassengerSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
  controller.registerPassenger,
);

router.post(
  "/login",
  validate({ body: loginSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
  controller.loginUser,
);

module.exports = router;