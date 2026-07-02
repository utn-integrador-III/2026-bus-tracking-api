"use strict";

const googleRoutesService = require("../services/googleRoutes.service");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const computeRoute = asyncHandler(async function computeRoute(req, res) {
  const result = await googleRoutesService.computeRoute(req.valid.body);

  res.status(HTTP_STATUS.OK).json(result);
});

module.exports = {
  computeRoute,
};