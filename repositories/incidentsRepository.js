"use strict";

const SupabasePassengerIncidentRepository = require("../src/modules/passenger-incidents/infrastructure/SupabasePassengerIncidentRepository");

const repository = new SupabasePassengerIncidentRepository();

module.exports = {
  createPassengerIncident: repository.createPassengerIncident.bind(repository),
  findIncidentsByTripId: repository.findIncidentsByTripId.bind(repository),
};