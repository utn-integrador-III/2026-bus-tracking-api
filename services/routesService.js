"use strict";

const routesRepository = require("../repositories/routesRepository");
const { RouteService } = require("../src/modules/routes");

module.exports = new RouteService(routesRepository);
