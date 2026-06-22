"use strict";

const authService = require("../services/auth.service");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const registerPassenger = asyncHandler(async function registerPassenger(req, res) {
  const result = await authService.registerPassenger(req.valid.body);

  res.status(HTTP_STATUS.CREATED).json({
    user_id: result.user.id,
    role: result.user.role,
    passenger: result.passenger,
  });
});

const loginUser = asyncHandler(async function loginUser(req, res) {
  const result = await authService.loginUser(req.valid.body);

  res.status(HTTP_STATUS.OK).json(result);
});

module.exports = {
  registerPassenger,
  loginUser,
};