"use strict";

const { createPassengerIncidentsModule } = require("../src/modules/passenger-incidents");

const { passengerIncidentService } = createPassengerIncidentsModule();

module.exports = passengerIncidentService;