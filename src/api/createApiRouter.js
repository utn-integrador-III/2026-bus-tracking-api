"use strict";

const express = require("express");
const authRoutes = require("../../routes/auth.routes");
const passengerIncidentsRouter = require("../../routes/passengerIncidentsRouter");
const { createAdminRoutesRouter, createConsumerRoutesRouter } = require("../modules/routes");
const { createAdminTripsRouter, createConsumerTripsRouter } = require("../modules/trips");
const { createPassengerTrackingRouter } = require("../modules/passenger-tracking/index");
const { createPassengerNotificationRouter } = require("../modules/notifications");

function createApiRouter() {
  const router = express.Router();

  router.use("/auth", authRoutes);
  router.use("/admin/routes", createAdminRoutesRouter());
  router.use("/passenger/routes", createConsumerRoutesRouter());
  router.use("/passenger/incidents", passengerIncidentsRouter);
  router.use("/passenger", createPassengerNotificationRouter());
  router.use("/admin/trips", createAdminTripsRouter());
  router.use("/passenger/trips", createConsumerTripsRouter());
  router.use("/passenger/tracking", createPassengerTrackingRouter());

  return router;
}

module.exports = createApiRouter;
