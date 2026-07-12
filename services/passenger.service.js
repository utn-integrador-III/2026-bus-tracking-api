"use strict";

const incidentsRepository = require("../repositories/incidentsRepository");

async function createPassengerIncident(payload) {
  return incidentsRepository.createPassengerIncident({
    trip_id: payload.trip_id,
    type: payload.type,
    description: payload.description || null,
    latitude: payload.latitude,
    longitude: payload.longitude,
  });
}

async function listPassengerIncidents(query) {
  return incidentsRepository.findIncidentsByTripId(query.trip_id);
}

module.exports = {
  createPassengerIncident,
  listPassengerIncidents,
};