"use strict";

const express = require("express");
const validate = require("../middleware/validate");
const {
  createRouteSchema,
  updateRouteSchema,
  idParamSchema,
} = require("../models/routeSchema");
const controller = require("../controllers/routesController");

const router = express.Router();

router.get("/", controller.listAdminRoutes);

router.post("/", validate({ body: createRouteSchema }), controller.createRoute);

router.get("/:id", validate({ params: idParamSchema }), controller.getRoute);

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

router.post(
  "/:id/reactivate",
  validate({ params: idParamSchema }),
  controller.reactivateRoute,
);

module.exports = router;
