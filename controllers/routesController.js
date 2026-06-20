"use strict";

const routesService = require("../services/routesService");
const routeView = require("../views/routeView");
const asyncHandler = require("../utils/asyncHandler");
const { HTTP_STATUS } = require("../constants/httpStatus");

const listAdminRoutes = asyncHandler(async function listAdminRoutes(_req, res) {
  const rows = await routesService.listAll();
  res.status(HTTP_STATUS.OK).json(routeView.presentAdminRoutes(rows));
});

const createRoute = asyncHandler(async function createRoute(req, res) {
  const row = await routesService.create(req.valid.body);
  res.status(HTTP_STATUS.CREATED).json(routeView.created(row));
});

const updateRoute = asyncHandler(async function updateRoute(req, res) {
  await routesService.update(req.valid.params.id, req.valid.body);
  res.status(HTTP_STATUS.OK).json(routeView.updated());
});

const deactivateRoute = asyncHandler(async function deactivateRoute(req, res) {
  await routesService.deactivate(req.valid.params.id);
  res.status(HTTP_STATUS.OK).json(routeView.deleted());
});

const listConsumerRoutes = asyncHandler(async function listConsumerRoutes(_req, res) {
  const rows = await routesService.listActive();
  res.status(HTTP_STATUS.OK).json(routeView.presentConsumerRoutes(rows));
});

module.exports = {
  listAdminRoutes,
  createRoute,
  updateRoute,
  deactivateRoute,
  listConsumerRoutes,
};
