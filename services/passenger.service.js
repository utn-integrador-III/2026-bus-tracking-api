"use strict";

const incidentsRepository = require("../repositories/incidentsRepository");

async function createPassengerIncident(payload) {
  return incidentsRepository.createPassengerIncident({
    trip_id: payload.trip_id,
    user_id: payload.user_id,
    type: payload.type,
    description: payload.description,
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