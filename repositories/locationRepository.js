"use strict";

const SupabaseLocationRepository = require("../src/modules/driver-trips/infrastructure/SupabaseLocationRepository");

const repository = new SupabaseLocationRepository();

module.exports = {
  createLocation: repository.createLocation.bind(repository),
  batchInsertLocations: repository.batchInsertLocations.bind(repository),
  getLatestByTripId: repository.getLatestByTripId.bind(repository),
};
