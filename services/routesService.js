"use strict";

const routesRepository = require("../repositories/routesRepository");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

function notFound() {
  return new AppError(
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.ROUTE_NOT_FOUND,
    "La ruta solicitada no existe.",
  );
}

async function listAll() {
  return routesRepository.listRoutes({ includeInactive: true });
}

async function listActive() {
  return routesRepository.listRoutes({ includeInactive: false });
}

async function create(payload) {
  return routesRepository.createRoute({
    name: payload.name,
    origin: payload.origin,
    destination: payload.destination,
    geometry_geojson: payload.geometry_geojson,
  });
}

async function update(id, payload) {
  const existing = await routesRepository.getRouteById(id);
  if (!existing) {
    throw notFound();
  }
  const patch = {};
  if (payload.name !== undefined) {
    patch.name = payload.name;
  }
  if (payload.origin !== undefined) {
    patch.origin = payload.origin;
  }
  if (payload.destination !== undefined) {
    patch.destination = payload.destination;
  }
  if (payload.geometry_geojson !== undefined) {
    patch.geometry_geojson = payload.geometry_geojson;
  }
  const updated = await routesRepository.updateRoute(id, patch);
  if (!updated) {
    throw notFound();
  }
  return updated;
}

async function getById(id) {
  const existing = await routesRepository.getRouteById(id);
  if (!existing) {
    throw notFound();
  }
  return existing;
}

async function deactivate(id) {
  const existing = await routesRepository.getRouteById(id);
  if (!existing) {
    throw notFound();
  }
  return routesRepository.setRouteActive(id, false);
}

async function reactivate(id) {
  const existing = await routesRepository.getRouteById(id);
  if (!existing) {
    throw notFound();
  }
  return routesRepository.setRouteActive(id, true);
}

module.exports = {
  listAll,
  listActive,
  getById,
  create,
  update,
  deactivate,
  reactivate,
};
