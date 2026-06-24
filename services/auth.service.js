"use strict";

const { createAuthModule } = require("../src/modules/auth");

const { authService } = createAuthModule();

module.exports = authService;