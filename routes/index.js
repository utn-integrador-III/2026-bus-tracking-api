"use strict";

const express = require("express");
const adminRoutesRouter = require("./adminRoutesRouter");
const passengerRoutesRouter = require("./passengerRoutesRouter");
const adminTripsRouter = require("./adminTripsRouter");
const passengerTripsRouter = require("./passengerTripsRouter");

const router = express.Router();

router.use("/admin/routes", adminRoutesRouter);
router.use("/passenger/routes", passengerRoutesRouter);
router.use("/admin/trips", adminTripsRouter);
router.use("/passenger/trips", passengerTripsRouter);

module.exports = router;
