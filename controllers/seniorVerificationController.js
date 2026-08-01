"use strict";

const seniorVerificationService = require("../services/seniorVerification.service");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const listRequests = asyncHandler(async function listRequests(req, res) {
  const result = await seniorVerificationService.listRequests(req.valid.query);

  res.status(HTTP_STATUS.OK).json(result);
});

const getRequest = asyncHandler(async function getRequest(req, res) {
  const result = await seniorVerificationService.getRequestById(req.valid.params.id);

  res.status(HTTP_STATUS.OK).json(result);
});

const approveRequest = asyncHandler(async function approveRequest(req, res) {
  const result = await seniorVerificationService.approveRequest(
    req.valid.params.id,
    {
      ...req.valid.body,
      reviewed_by: req.auth.userId,
    },
  );

  res.status(HTTP_STATUS.OK).json(result);
});

const rejectRequest = asyncHandler(async function rejectRequest(req, res) {
  const result = await seniorVerificationService.rejectRequest(
    req.valid.params.id,
    {
      ...req.valid.body,
      reviewed_by: req.auth.userId,
    },
  );

  res.status(HTTP_STATUS.OK).json(result);
});

module.exports = {
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
};