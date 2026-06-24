"use strict";

const passengerService = require("../services/passenger.service");
const { PassengerIncidentController } = require("../src/modules/passenger-incidents");

module.exports = new PassengerIncidentController(passengerService);