"use strict";

const {
  idParamSchema,
  listSeniorRequestsQuerySchema,
  approveSeniorRequestSchema,
  rejectSeniorRequestSchema,
} = require("../seniorVerification.model");

describe("seniorVerification.model", () => {
  test("accepts a valid id param", () => {
    const result = idParamSchema.safeParse({
      id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });

    expect(result.success).toBe(true);
  });

  test("rejects an invalid id param", () => {
    const result = idParamSchema.safeParse({
      id: "invalid-id",
    });

    expect(result.success).toBe(false);
  });

  test("accepts a valid status query", () => {
    const result = listSeniorRequestsQuerySchema.safeParse({
      status: "pending",
    });

    expect(result.success).toBe(true);
  });

  test("rejects an invalid status query", () => {
    const result = listSeniorRequestsQuerySchema.safeParse({
      status: "invalid",
    });

    expect(result.success).toBe(false);
  });

  test("accepts an empty approve payload", () => {
    const result = approveSeniorRequestSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  test("accepts an approve payload with reviewed_by", () => {
    const result = approveSeniorRequestSchema.safeParse({
      reviewed_by: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });

    expect(result.success).toBe(true);
  });

  test("rejects a reject payload without rejection_reason", () => {
    const result = rejectSeniorRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  test("accepts a valid reject payload", () => {
    const result = rejectSeniorRequestSchema.safeParse({
      rejection_reason: "The uploaded document is not readable.",
    });

    expect(result.success).toBe(true);
  });
});