"use strict";

const { createTripModule } = require("../src/modules/trips");

const { tripController } = createTripModule();

module.exports = tripController;
