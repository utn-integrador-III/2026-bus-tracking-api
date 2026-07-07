"use strict";

const { z } = require("zod");

const checkoutTicketSchema = z.object({
  trip_id: z.string().uuid("trip_id must be a valid UUID."),
});

module.exports = {
  checkoutTicketSchema,
};