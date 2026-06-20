"use strict";

const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const controller = require("../controllers/routesController");

const router = express.Router();

router.use(requireAuth);

router.get("/", controller.listConsumerRoutes);

module.exports = router;
