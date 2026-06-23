"use strict";

const express = require("express");
const authRoutes = require("./auth.routes");
const passengerIncidentsRouter = require("./passengerIncidentsRouter");
const adminRoutesRouter = require("./adminRoutesRouter");
const passengerRoutesRouter = require("./passengerRoutesRouter");
const adminTripsRouter = require("./adminTripsRouter");
const passengerTripsRouter = require("./passengerTripsRouter");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/admin/routes", adminRoutesRouter);
router.use("/passenger/routes", passengerRoutesRouter);
router.use("/passenger/incidents", passengerIncidentsRouter);
router.use("/admin/trips", adminTripsRouter);
router.use("/passenger/trips", passengerTripsRouter);

module.exports = router;
