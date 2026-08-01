"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const controller = require("../controllers/authController");
const {
  registerPassengerSchema,
  loginSchema,
  oauthStartSchema,
  seniorDocumentUploadUrlSchema,
} = require("../models/auth.model");
const { ERROR_CODES } = require("../constants/errorCodes");

const router = express.Router();

router.post(
  "/senior-document/upload-url",
  requireAuth,
  validate({ body: seniorDocumentUploadUrlSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
  controller.createSeniorDocumentUploadUrl,
);

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

router.post(
  "/admin/login",
  validate({ body: loginSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
  controller.loginAdmin,
);

router.post(
  "/driver/login",
  validate({ body: loginSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
  controller.loginDriver,
);

router.post(
  "/oauth/start",
  validate({ body: oauthStartSchema }, ERROR_CODES.AUTH_VALIDATION_FAILED),
  controller.startOAuth,
);

router.get("/session", requireAuth, controller.getSession);

module.exports = router;
