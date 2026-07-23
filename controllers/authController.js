"use strict";

const authService = require("../services/auth.service");
const { AuthController } = require("../src/modules/auth");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const authController = new AuthController(authService);

authController.loginDriver = asyncHandler(async function loginDriver(req, res) {
  const result = await authService.loginDriver(req.valid.body, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent") ?? null,
  });

  res.status(HTTP_STATUS.OK).json(result);
});

authController.createSeniorDocumentUploadUrl = asyncHandler(
  async function createSeniorDocumentUploadUrl(req, res) {
    const result = await authService.createSeniorDocumentUploadUrl(req.valid.body);

    res.status(HTTP_STATUS.OK).json(result);
  },
);

module.exports = authController;
