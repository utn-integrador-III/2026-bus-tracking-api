"use strict";

const { z } = require("zod");

const name = z.string().trim().min(1).max(100);
const email = z.string().trim().email().max(150);
const password = z.string().min(8).max(100);
const phone = z.string().trim().min(8).max(30).optional();

const registerPassengerSchema = z
  .object({
    name,
    email,
    password,
    phone,
  })
  .strict();

const loginSchema = z
  .object({
    email,
    password,
  })
  .strict();

module.exports = {
  registerPassengerSchema,
  loginSchema,
};