"use strict";

const createApiRouter = require("../src/api/createApiRouter");
const adminDriversRouter = require("./adminDriversRouter");
const googleRoutesRouter = require("./googleRoutesRouter");
const adminSeniorRequestsRouter = require("./adminSeniorRequestsRouter");
const driverTripsRouter = require("./driverTripsRouter");
const { createTicketsRouter } = require("../src/modules/tickets");

const router = createApiRouter();

router.use("/admin/drivers", adminDriversRouter);
router.use("/google/routes", googleRoutesRouter);
router.use("/admin/senior-requests", adminSeniorRequestsRouter);
router.use("/driver/trips", driverTripsRouter);
router.use("/tickets", createTicketsRouter());

module.exports = router;