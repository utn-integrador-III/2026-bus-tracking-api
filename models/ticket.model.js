"use strict";

const { z } = require("zod");

const checkoutTicketSchema = z
  .object({
    trip_id: z.string().uuid("trip_id must be a valid UUID."),
  })
  .strict();

const scanTicketSchema = z
  .object({
    ticket_id: z.string().uuid("ticket_id must be a valid UUID."),
  })
  .strict();

module.exports = {
  checkoutTicketSchema,
  scanTicketSchema,
};