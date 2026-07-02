"use strict";

const { z } = require("zod");

const name = z.string().trim().min(1).max(100);
const email = z.string().trim().email().max(150);
const password = z.string().min(8).max(100);
const licenseNumber = z.string().trim().min(1).max(80);

const createDriverSchema = z
  .object({
    name,
    email,
    password,
    license_number: licenseNumber,
  })
  .strict();

const updateDriverSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    license_number: licenseNumber.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update.",
  });

const idParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

module.exports = {
  createDriverSchema,
  updateDriverSchema,
  idParamSchema,
};