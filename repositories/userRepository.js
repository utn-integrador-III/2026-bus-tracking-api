"use strict";

const SupabaseUserRepository = require("../src/modules/auth/infrastructure/SupabaseUserRepository");

const repository = new SupabaseUserRepository();

module.exports = {
  findUserById: repository.findUserById.bind(repository),
  findUserByEmail: repository.findUserByEmail.bind(repository),
  createUserProfile: repository.createUserProfile.bind(repository),
};