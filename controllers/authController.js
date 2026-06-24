"use strict";

const authService = require("../services/auth.service");
const { AuthController } = require("../src/modules/auth");

module.exports = new AuthController(authService);