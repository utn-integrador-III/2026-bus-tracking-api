"use strict";

const SupabaseTripRepository = require("../src/modules/trips/infrastructure/SupabaseTripRepository");

const repository = new SupabaseTripRepository();

module.exports = {
  listTrips: repository.listTrips.bind(repository),
  getTripById: repository.getTripById.bind(repository),
  createTrip: repository.createTrip.bind(repository),
  updateTrip: repository.updateTrip.bind(repository),
  setTripStatus: repository.setTripStatus.bind(repository),
};
