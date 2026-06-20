"use strict";

const express = require("express");
const adminRoutesRouter = require("./adminRoutesRouter");
const passengerRoutesRouter = require("./passengerRoutesRouter");

const router = express.Router();

router.use("/admin/routes", adminRoutesRouter);
router.use("/passenger/routes", passengerRoutesRouter);

module.exports = router;
