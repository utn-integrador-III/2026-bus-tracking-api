"use strict";

const express = require("express");
const authRoutes = require("../../routes/auth.routes");
const passengerIncidentsRouter = require("../../routes/passengerIncidentsRouter");
const { createAdminRoutesRouter, createConsumerRoutesRouter } = require("../modules/routes");
const { createAdminTripsRouter, createConsumerTripsRouter } = require("../modules/trips");
const {
  createPassengerTrackingRouter,
  createPassengerPushTokenRouter,
} = require("../modules/passenger-tracking/index");
const { createPassengerNotificationRouter } = require("../modules/notifications");
const { createDriverIncidentsRouter } = require("../modules/driver-trips/index");
const mapIncidentsRouter = require("../../routes/mapIncidentsRouter");
const {
  createAdminBusesRouter,
  createAdminStopsRouter,
  createPassengerStopsRouter,
  createAdminIncidentsRouter,
  createAdminTelemetryRouter,
  createAdminUsersRouter,
} = require("../modules/admin/index");

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
  router.use("/passenger/push-token", createPassengerPushTokenRouter());
  router.use("/driver/incidents", createDriverIncidentsRouter());
  router.use("/incidents/map", mapIncidentsRouter);
  router.use("/admin/buses", createAdminBusesRouter());
  router.use("/admin/stops", createAdminStopsRouter());
  router.use("/passenger/stops", createPassengerStopsRouter());
  router.use("/admin/incidents", createAdminIncidentsRouter());
  router.use("/admin/telemetry", createAdminTelemetryRouter());
  router.use("/admin/users", createAdminUsersRouter());

  return router;
}

module.exports = createApiRouter;
