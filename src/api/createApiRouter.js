"use strict";

const express = require("express");
const authRoutes = require("../../routes/auth.routes");
const passengerIncidentsRouter = require("../../routes/passengerIncidentsRouter");
const { createAdminRoutesRouter, createConsumerRoutesRouter } = require("../modules/routes");
const { createAdminTripsRouter, createConsumerTripsRouter } = require("../modules/trips");
const { createPassengerTrackingRouter } = require("../modules/passenger-tracking/index");
const { createDriverIncidentsRouter } = require("../modules/driver-trips/index");
const mapIncidentsRouter = require("../../routes/mapIncidentsRouter");

function createApiRouter() {
  const router = express.Router();

  router.use("/auth", authRoutes);
  router.use("/admin/routes", createAdminRoutesRouter());
  router.use("/passenger/routes", createConsumerRoutesRouter());
  router.use("/passenger/incidents", passengerIncidentsRouter);
  router.use("/admin/trips", createAdminTripsRouter());
  router.use("/passenger/trips", createConsumerTripsRouter());
  router.use("/passenger/tracking", createPassengerTrackingRouter());
  router.use("/driver/incidents", createDriverIncidentsRouter());
  router.use("/incidents/map", mapIncidentsRouter);

  return router;
}

module.exports = createApiRouter;