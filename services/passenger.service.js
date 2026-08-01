"use strict";

const incidentsRepository = require("../repositories/incidentsRepository");
const { isVisibleToPassengers } = require("../constants/reportModerationStatus");

function toPassengerFacingIncident(row) {
  if (!row) {
    return row;
  }
  const { user_id: _userId, ...incident } = row;
  return incident;
}

async function createPassengerIncident(payload) {
  const row = await incidentsRepository.createPassengerIncident({
    trip_id: payload.trip_id,
    user_id: payload.user_id,
    type: payload.type,
    description: payload.description,
    latitude: payload.latitude,
    longitude: payload.longitude,
  });

  return toPassengerFacingIncident(row);
}

async function listPassengerIncidents(query) {
  const rows = await incidentsRepository.findIncidentsByTripId(query.trip_id);

  return (rows || [])
    .filter((row) => isVisibleToPassengers(row.moderation_status))
    .map(toPassengerFacingIncident);
}

module.exports = {
  createPassengerIncident,
  listPassengerIncidents,
};
