"use strict";

const driverService = require("../services/driver.service");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const listDrivers = asyncHandler(async function listDrivers(_req, res) {
  const rows = await driverService.listDrivers();

  res.status(HTTP_STATUS.OK).json(rows);
});

const getDriver = asyncHandler(async function getDriver(req, res) {
  const row = await driverService.getDriverById(req.valid.params.id);

  res.status(HTTP_STATUS.OK).json(row);
});

const createDriver = asyncHandler(async function createDriver(req, res) {
  const row = await driverService.createDriver(req.valid.body);

  res.status(HTTP_STATUS.CREATED).json(row);
});

const updateDriver = asyncHandler(async function updateDriver(req, res) {
  const row = await driverService.updateDriver(req.valid.params.id, req.valid.body);

  res.status(HTTP_STATUS.OK).json(row);
});

const deactivateDriver = asyncHandler(async function deactivateDriver(req, res) {
  const row = await driverService.deactivateDriver(req.valid.params.id);

  res.status(HTTP_STATUS.OK).json(row);
});

module.exports = {
  listDrivers,
  getDriver,
  createDriver,
  updateDriver,
  deactivateDriver,
};