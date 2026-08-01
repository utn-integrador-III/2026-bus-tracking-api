"use strict";

const SupabasePassengerIncidentRepository = require("../src/modules/passenger-incidents/infrastructure/SupabasePassengerIncidentRepository");

const repository = new SupabasePassengerIncidentRepository();

async function findIncidentsByTripId(tripId, options = {}) {
  const rows = await repository.findIncidentsByTripId(tripId);

  if (!options.since) {
    return rows || [];
  }

  const threshold = Date.parse(options.since);

  if (Number.isNaN(threshold)) {
    return rows || [];
  }

  return (rows || []).filter((row) => Date.parse(row.timestamp) >= threshold);
}

module.exports = {
  createPassengerIncident: repository.createPassengerIncident.bind(repository),
  findIncidentsByTripId,
};
