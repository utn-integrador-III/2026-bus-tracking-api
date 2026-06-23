"use strict";

const tripsService = require("../services/tripsService");
const tripView = require("../views/tripView");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const listAdminTrips = asyncHandler(async function listAdminTrips(_req, res) {
  const rows = await tripsService.listAll();
  res.status(HTTP_STATUS.OK).json(tripView.presentAdminTrips(rows));
});

const getTrip = asyncHandler(async function getTrip(req, res) {
  const row = await tripsService.getById(req.valid.params.id);
  res.status(HTTP_STATUS.OK).json(tripView.presentAdminTrip(row));
});

const createTrip = asyncHandler(async function createTrip(req, res) {
  const row = await tripsService.create(req.valid.body);
  res.status(HTTP_STATUS.CREATED).json(tripView.created(row));
});

const updateTrip = asyncHandler(async function updateTrip(req, res) {
  await tripsService.update(req.valid.params.id, req.valid.body);
  res.status(HTTP_STATUS.OK).json(tripView.updated());
});

const deactivateTrip = asyncHandler(async function deactivateTrip(req, res) {
  await tripsService.deactivate(req.valid.params.id);
  res.status(HTTP_STATUS.OK).json(tripView.deleted());
});

const reactivateTrip = asyncHandler(async function reactivateTrip(req, res) {
  await tripsService.reactivate(req.valid.params.id);
  res.status(HTTP_STATUS.OK).json(tripView.reactivated());
});

const listConsumerTrips = asyncHandler(async function listConsumerTrips(_req, res) {
  const rows = await tripsService.listVisible();
  res.status(HTTP_STATUS.OK).json(tripView.presentConsumerTrips(rows));
});

module.exports = {
  listAdminTrips,
  getTrip,
  createTrip,
  updateTrip,
  deactivateTrip,
  reactivateTrip,
  listConsumerTrips,
};
