"use strict";

const { checkoutTicketSchema } = require("../ticket.model");

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
});