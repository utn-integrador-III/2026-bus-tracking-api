"use strict";

const { checkoutTicketSchema, scanTicketSchema } = require("../ticket.model");

describe("ticket.model", () => {
  test("validates a valid checkout payload", () => {
    const payload = {
      trip_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    };

    const result = checkoutTicketSchema.safeParse(payload);

    expect(result.success).toBe(true);
  });

  test("rejects an invalid trip_id", () => {
    const payload = {
      trip_id: "not-a-valid-uuid",
    };

    const result = checkoutTicketSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });

  test("rejects missing trip_id", () => {
    const result = checkoutTicketSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys in the checkout payload", () => {
    const result = checkoutTicketSchema.safeParse({
      trip_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      payment_type: "Senior_Exemption",
      fare: 999,
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown keys in the scan payload", () => {
    const result = scanTicketSchema.safeParse({
      ticket_id: "9f2504e0-4f89-41d3-9a0c-0305e82c3309",
      driver_id: "15740dd7-9b7f-4838-aaf8-b59141e7edac",
    });

    expect(result.success).toBe(false);
  });
});