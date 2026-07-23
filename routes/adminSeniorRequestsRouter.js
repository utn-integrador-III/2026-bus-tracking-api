"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const controller = require("../controllers/seniorVerificationController");
const {
  idParamSchema,
  listSeniorRequestsQuerySchema,
  approveSeniorRequestSchema,
  rejectSeniorRequestSchema,
} = require("../models/seniorVerification.model");
const { ERROR_CODES } = require("../constants/errorCodes");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get(
  "/",
  validate(
    { query: listSeniorRequestsQuerySchema },
    ERROR_CODES.SENIOR_VERIFICATION_VALIDATION_FAILED,
  ),
  controller.listRequests,
);

router.get(
  "/:id",
  validate(
    { params: idParamSchema },
    ERROR_CODES.SENIOR_VERIFICATION_VALIDATION_FAILED,
  ),
  controller.getRequest,
);

router.patch(
  "/:id/approve",
  validate(
    {
      params: idParamSchema,
      body: approveSeniorRequestSchema,
    },
    ERROR_CODES.SENIOR_VERIFICATION_VALIDATION_FAILED,
  ),
  controller.approveRequest,
);

router.patch(
  "/:id/reject",
  validate(
    {
      params: idParamSchema,
      body: rejectSeniorRequestSchema,
    },
    ERROR_CODES.SENIOR_VERIFICATION_VALIDATION_FAILED,
  ),
  controller.rejectRequest,
);

module.exports = router;