"use strict";

const express = require("express");
const controller = require("../controllers/routesController");

const router = express.Router();

router.get("/", controller.listConsumerRoutes);

module.exports = router;
