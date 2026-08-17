"use strict";

jest.mock("../../database/supabaseClient", () => ({ getServiceClient: jest.fn() }));

const { getServiceClient } = require("../../database/supabaseClient");
const { createSupabaseMock } = require("../../testUtils/supabaseMock");
const roles = require("../userRoleRepository");
const drivers = require("../driverRepository");
const passengers = require("../passengerRepository");
const senior = require("../seniorVerificationRepository");

function setup(responses) {
  const mock = createSupabaseMock(responses);
  getServiceClient.mockReturnValue(mock.client);
  return mock;
}

function databaseFailure(message = "query failed") {
  return { error: { message } };
}

describe("userRoleRepository", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates a role when it does not exist", async () => {
    const payload = { user_id: "user-1", role: "Driver", license_number: "L1" };
    const { queries } = setup([
      { data: null, error: null },
      { data: { id: "role-1", ...payload }, error: null },
    ]);
    await expect(roles.createUserRole(payload)).resolves.toMatchObject({ id: "role-1" });
    expect(queries[1].insert).toHaveBeenCalledWith(payload);
  });

  test("updates an existing role while preserving omitted metadata", async () => {
    const existing = {
      id: "role-1",
      user_id: "user-1",
      role: "Driver",
      license_number: "OLD",
      employee_code: "EMP-1",
    };
    const { queries } = setup([
      { data: existing, error: null },
      { data: { ...existing, license_number: "NEW" }, error: null },
    ]);
    await roles.createUserRole({
      user_id: "user-1",
      role: "Driver",
      license_number: "NEW",
    });
    expect(queries[1].update).toHaveBeenCalledWith({
      license_number: "NEW",
      employee_code: "EMP-1",
    });
  });

  test("preserves an existing license and accepts an explicit employee code", async () => {
    const existing = { license_number: "OLD", employee_code: "OLD-EMP" };
    const { queries } = setup([
      { data: existing, error: null },
      { data: existing, error: null },
    ]);
    await roles.createUserRole({ user_id: "user-1", role: "Admin", employee_code: null });
    expect(queries[1].update).toHaveBeenCalledWith({
      license_number: "OLD",
      employee_code: null,
    });
  });

  test.each([
    ["findRoleByUserId", ["user-1"]],
    ["findRoleByUserIdAndRole", ["user-1", "Driver"]],
    ["updateRoleByUserIdAndRole", ["user-1", "Driver", { license_number: "L2" }]],
  ])("returns data and null from %s", async (method, args) => {
    setup([{ data: { id: "role-1" }, error: null }]);
    await expect(roles[method](...args)).resolves.toEqual({ id: "role-1" });
    setup([{ data: null, error: null }]);
    await expect(roles[method](...args)).resolves.toBeNull();
  });

  test("lists roles and normalizes empty data", async () => {
    setup([{ data: [{ id: "role-1" }], error: null }]);
    await expect(roles.listRolesByRole("Driver")).resolves.toHaveLength(1);
    setup([{ data: null, error: null }]);
    await expect(roles.listRolesByRole("Driver")).resolves.toEqual([]);
  });

  test.each([
    ["createUserRole", [{ user_id: "user-1", role: "Driver" }], [
      { data: null, error: null }, databaseFailure("insert failed"),
    ]],
    ["findRoleByUserId", ["user-1"], [databaseFailure()]],
    ["findRoleByUserIdAndRole", ["user-1", "Driver"], [databaseFailure()]],
    ["listRolesByRole", ["Driver"], [databaseFailure()]],
    ["updateRoleByUserIdAndRole", ["user-1", "Driver", {}], [databaseFailure()]],
  ])("maps database errors from %s", async (method, args, responses) => {
    setup(responses);
    await expect(roles[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("driverRepository", () => {
  beforeEach(() => jest.clearAllMocks());

  test("covers list, find, create and update results", async () => {
    setup([{ data: [{ user_id: "driver-1" }], error: null }]);
    await expect(drivers.listDriverProfiles()).resolves.toHaveLength(1);

    setup([{ data: null, error: null }]);
    await expect(drivers.listDriverProfiles()).resolves.toEqual([]);

    setup([{ data: { user_id: "driver-1" }, error: null }]);
    await expect(drivers.findDriverProfileByUserId("driver-1"))
      .resolves.toMatchObject({ user_id: "driver-1" });

    setup([{ data: null, error: null }]);
    await expect(drivers.findDriverProfileByUserId("missing")).resolves.toBeNull();

    setup([{ data: { user_id: "driver-1" }, error: null }]);
    await expect(drivers.createDriverProfile({ user_id: "driver-1" }))
      .resolves.toMatchObject({ user_id: "driver-1" });

    setup([{ data: null, error: null }]);
    await expect(drivers.updateDriverProfile("driver-1", {})).resolves.toBeNull();
  });

  test.each([
    ["listDriverProfiles", []],
    ["findDriverProfileByUserId", ["driver-1"]],
    ["createDriverProfile", [{ user_id: "driver-1" }]],
    ["updateDriverProfile", ["driver-1", {}]],
  ])("maps database errors from %s", async (method, args) => {
    setup([databaseFailure()]);
    await expect(drivers[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("passengerRepository", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates, finds and updates passenger profiles", async () => {
    const row = { user_id: "passenger-1" };
    const created = setup([{ data: row, error: null }]);
    await expect(passengers.createPassengerProfile(row)).resolves.toEqual(row);
    expect(created.queries[0].upsert).toHaveBeenCalledWith(row, { onConflict: "user_id" });

    setup([{ data: row, error: null }]);
    await expect(passengers.findPassengerById("passenger-1")).resolves.toEqual(row);
    setup([{ data: null, error: null }]);
    await expect(passengers.findPassengerById("missing")).resolves.toBeNull();

    setup([{ data: null, error: null }]);
    await expect(passengers.updatePassengerProfile("passenger-1", {})).resolves.toBeNull();
  });

  test.each([
    ["createPassengerProfile", [{ user_id: "passenger-1" }]],
    ["findPassengerById", ["passenger-1"]],
    ["updatePassengerProfile", ["passenger-1", {}]],
  ])("maps database errors from %s", async (method, args) => {
    setup([databaseFailure()]);
    await expect(passengers[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("seniorVerificationRepository", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates, finds and updates requests", async () => {
    const row = { id: "request-1" };
    setup([{ data: row, error: null }]);
    await expect(senior.createPendingRequest({ passenger_id: "passenger-1" }))
      .resolves.toEqual(row);

    setup([{ data: row, error: null }]);
    await expect(senior.findRequestById("request-1")).resolves.toEqual(row);
    setup([{ data: null, error: null }]);
    await expect(senior.findRequestById("missing")).resolves.toBeNull();

    setup([{ data: null, error: null }]);
    await expect(senior.updateRequest("request-1", {})).resolves.toBeNull();
  });

  test("lists requests with and without a status", async () => {
    const filtered = setup([{ data: [{ id: "request-1" }], error: null }]);
    await expect(senior.listRequests({ status: "Pending" })).resolves.toHaveLength(1);
    expect(filtered.queries[0].eq).toHaveBeenCalledWith("status", "Pending");

    const all = setup([{ data: null, error: null }]);
    await expect(senior.listRequests()).resolves.toEqual([]);
    expect(all.queries[0].eq).not.toHaveBeenCalled();
  });

  test("reviews a request with nullable optional values", async () => {
    const { client } = setup([{ data: { id: "request-1" }, error: null }]);
    await senior.reviewRequest({ request_id: "request-1", action: "approve" });
    expect(client.rpc).toHaveBeenCalledWith("review_senior_verification_request", {
      p_request_id: "request-1",
      p_action: "approve",
      p_reviewed_by: null,
      p_rejection_reason: null,
    });

    const explicit = setup([{ data: { id: "request-1" }, error: null }]);
    await senior.reviewRequest({
      request_id: "request-1",
      action: "reject",
      reviewed_by: "admin-1",
      rejection_reason: "Unreadable",
    });
    expect(explicit.client.rpc).toHaveBeenCalledWith(
      "review_senior_verification_request",
      expect.objectContaining({ p_reviewed_by: "admin-1", p_rejection_reason: "Unreadable" }),
    );
  });

  test.each([
    ["createPendingRequest", [{}]],
    ["listRequests", []],
    ["findRequestById", ["request-1"]],
    ["updateRequest", ["request-1", {}]],
    ["reviewRequest", [{ request_id: "request-1", action: "approve" }]],
  ])("maps database errors from %s", async (method, args) => {
    setup([databaseFailure()]);
    await expect(senior[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});
