"use strict";

const SupabasePassengerProfileRepository = require("../src/modules/auth/infrastructure/SupabasePassengerProfileRepository");

const repository = new SupabasePassengerProfileRepository();

module.exports = {
  createPassengerProfile: repository.createPassengerProfile.bind(repository),
};