"use strict";

const passengerService = require("../services/passenger.service");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const createPassengerIncident = asyncHandler(async function createPassengerIncident(req, res) {
  const row = await passengerService.createPassengerIncident(req.valid.body);

  res.status(HTTP_STATUS.CREATED).json({
    incident_id: row.id,
    incident: row,
  });
});

const listPassengerIncidents = asyncHandler(async function listPassengerIncidents(req, res) {
  const rows = await passengerService.listPassengerIncidents(req.valid.query);

  res.status(HTTP_STATUS.OK).json(rows);
});

module.exports = {
  createPassengerIncident,
  listPassengerIncidents,
};