"use strict";

const createApiRouter = require("../src/api/createApiRouter");
const adminDriversRouter = require("./adminDriversRouter");
const googleRoutesRouter = require("./googleRoutesRouter");
const adminSeniorRequestsRouter = require("./adminSeniorRequestsRouter");

const router = createApiRouter();

router.use("/admin/drivers", adminDriversRouter);
router.use("/google/routes", googleRoutesRouter);
router.use("/admin/senior-requests", adminSeniorRequestsRouter);

module.exports = router;