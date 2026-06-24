"use strict";

const SupabaseAuthAuditRepository = require("../src/modules/auth/infrastructure/SupabaseAuthAuditRepository");

const repository = new SupabaseAuthAuditRepository();

module.exports = {
  createLoginAuditLog: repository.createLoginAuditLog.bind(repository),
};