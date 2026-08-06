"use strict";

const incidentsRepository = require("../repositories/incidentsRepository");
const { incidentWindowStart } = require("../constants/incidentWindow");
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
  const rows = await incidentsRepository.findIncidentsByTripId(query.trip_id, {
    since: incidentWindowStart(),
  });

  return (rows || [])
    .filter((row) => isVisibleToPassengers(row.moderation_status))
    .map(toPassengerFacingIncident);
}

async function listMapIncidents(query) {
  const since = query.since
    ? new Date(query.since).toISOString()
    : new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const rows = await incidentsRepository.findIncidentsByTripIdSince(
    query.trip_id,
    since,
  );

  return (rows || [])
    .filter((row) => isVisibleToPassengers(row.moderation_status))
    .map(toPassengerFacingIncident);
}

module.exports = {
  createPassengerIncident,
  listPassengerIncidents,
  listMapIncidents,
};
