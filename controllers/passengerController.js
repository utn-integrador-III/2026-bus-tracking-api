"use strict";

const passengerService = require("../services/passenger.service");
const { PassengerIncidentController } = require("../src/modules/passenger-incidents");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const baseController = new PassengerIncidentController(passengerService);

baseController.listMapIncidents = asyncHandler(async (req, res) => {
  const rows = await passengerService.listMapIncidents(req.valid.query);
  res.status(HTTP_STATUS.OK).json(rows);
});

module.exports = baseController;
