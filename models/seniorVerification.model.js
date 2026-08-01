"use strict";

const { z } = require("zod");

const seniorStatus = z.enum(["pending", "approved", "rejected"]);

const idParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

const listSeniorRequestsQuerySchema = z
  .object({
    status: seniorStatus.optional(),
  })
  .strict();

const approveSeniorRequestSchema = z.object({}).strict();

const rejectSeniorRequestSchema = z
  .object({
    rejection_reason: z.string().trim().min(1).max(500),
  })
  .strict();

module.exports = {
  idParamSchema,
  listSeniorRequestsQuerySchema,
  approveSeniorRequestSchema,
  rejectSeniorRequestSchema,
};