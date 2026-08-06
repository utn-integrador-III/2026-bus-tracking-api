"use strict";

const SupabasePassengerIncidentRepository = require("../src/modules/passenger-incidents/infrastructure/SupabasePassengerIncidentRepository");

const repository = new SupabasePassengerIncidentRepository();

async function findIncidentsByTripId(tripId, options = {}) {
  if (
    options.since &&
    typeof repository.findIncidentsByTripIdSince === "function"
  ) {
    return repository.findIncidentsByTripIdSince(tripId, options.since);
  }

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

async function findIncidentsByTripIdSince(tripId, since) {
  if (typeof repository.findIncidentsByTripIdSince === "function") {
    return repository.findIncidentsByTripIdSince(tripId, since);
  }

  return findIncidentsByTripId(tripId, { since });
}

module.exports = {
  createPassengerIncident: repository.createPassengerIncident.bind(repository),
  findIncidentsByTripId,
  findIncidentsByTripIdSince,
};