"use strict";

const { createTripModule } = require("../src/modules/trips");

const { tripService } = createTripModule();

module.exports = tripService;
