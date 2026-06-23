"use strict";

const express = require("express");
const controller = require("../controllers/tripsController");

const router = express.Router();

router.get("/", controller.listConsumerTrips);

module.exports = router;
