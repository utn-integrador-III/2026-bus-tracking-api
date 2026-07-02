"use strict";

const SupabaseRouteRepository = require("../src/modules/routes/infrastructure/SupabaseRouteRepository");

const repository = new SupabaseRouteRepository();

module.exports = {
  listRoutes: repository.listRoutes.bind(repository),
  getRouteById: repository.getRouteById.bind(repository),
  createRoute: repository.createRoute.bind(repository),
  updateRoute: repository.updateRoute.bind(repository),
  setRouteActive: repository.setRouteActive.bind(repository),
};
