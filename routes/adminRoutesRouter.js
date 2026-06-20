"use strict";

const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");
const { ROLES } = require("../constants/roles");
const {
  createRouteSchema,
  updateRouteSchema,
  idParamSchema,
} = require("../models/routeSchema");
const controller = require("../controllers/routesController");

const router = express.Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get("/", controller.listAdminRoutes);

router.post("/", validate({ body: createRouteSchema }), controller.createRoute);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateRouteSchema }),
  controller.updateRoute,
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  controller.deactivateRoute,
);

module.exports = router;
