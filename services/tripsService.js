"use strict";

const tripsRepository = require("../repositories/tripsRepository");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");
const { TRIP_STATUS, CONSUMER_VISIBLE_STATUSES } = require("../constants/tripStatus");

function notFound() {
  return new AppError(
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.TRIP_NOT_FOUND,
    "El viaje solicitado no existe.",
  );
}

async function listAll() {
  return tripsRepository.listTrips({});
}

async function listVisible() {
  return tripsRepository.listTrips({ statuses: CONSUMER_VISIBLE_STATUSES });
}

async function getById(id) {
  const existing = await tripsRepository.getTripById(id);
  if (!existing) {
    throw notFound();
  }
  return existing;
}

async function create(payload) {
  const trip = {
    route_id: payload.route_id,
    bus_id: payload.bus_id,
    driver_id: payload.driver_id,
    departure_time: payload.departure_time,
  };
  if (payload.arrival_time !== undefined) {
    trip.arrival_time = payload.arrival_time;
  }
  if (payload.status !== undefined) {
    trip.status = payload.status;
  }
  return tripsRepository.createTrip(trip);
}

async function update(id, payload) {
  const existing = await tripsRepository.getTripById(id);
  if (!existing) {
    throw notFound();
  }
  const patch = {};
  if (payload.route_id !== undefined) {
    patch.route_id = payload.route_id;
  }
  if (payload.bus_id !== undefined) {
    patch.bus_id = payload.bus_id;
  }
  if (payload.driver_id !== undefined) {
    patch.driver_id = payload.driver_id;
  }
  if (payload.departure_time !== undefined) {
    patch.departure_time = payload.departure_time;
  }
  if (payload.arrival_time !== undefined) {
    patch.arrival_time = payload.arrival_time;
  }
  if (payload.status !== undefined) {
    patch.status = payload.status;
  }
  const updated = await tripsRepository.updateTrip(id, patch);
  if (!updated) {
    throw notFound();
  }
  return updated;
}

async function deactivate(id) {
  const existing = await tripsRepository.getTripById(id);
  if (!existing) {
    throw notFound();
  }
  return tripsRepository.setTripStatus(id, TRIP_STATUS.CANCELLED);
}

async function reactivate(id) {
  const existing = await tripsRepository.getTripById(id);
  if (!existing) {
    throw notFound();
  }
  return tripsRepository.setTripStatus(id, TRIP_STATUS.SCHEDULED);
}

module.exports = {
  listAll,
  listVisible,
  getById,
  create,
  update,
  deactivate,
  reactivate,
};
