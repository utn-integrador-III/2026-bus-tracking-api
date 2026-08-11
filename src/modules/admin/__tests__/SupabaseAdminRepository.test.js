"use strict";

jest.mock("../../../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
}));

const { getServiceClient } = require("../../../../database/supabaseClient");
const { createSupabaseMock } = require("../../../../testUtils/supabaseMock");
const SupabaseAdminRepository = require("../infrastructure/SupabaseAdminRepository");

function setup(responses) {
  const mock = createSupabaseMock(responses);
  getServiceClient.mockReturnValue(mock.client);
  return { repository: new SupabaseAdminRepository(), ...mock };
}

function expectDatabaseError(promise, message) {
  return expect(promise).rejects.toMatchObject({
    statusCode: 500,
    code: "DATABASE_ERROR",
    message,
  });
}

describe("SupabaseAdminRepository", () => {
  beforeEach(() => jest.clearAllMocks());

  test("lists buses and normalizes an empty response", async () => {
    const first = setup([{ data: [{ id: "bus-1" }], error: null }]);
    await expect(first.repository.listBuses()).resolves.toEqual([{ id: "bus-1" }]);
    expect(first.client.from).toHaveBeenCalledWith("buses");

    const second = setup([{ data: null, error: null }]);
    await expect(second.repository.listBuses()).resolves.toEqual([]);
  });

  test("maps errors while listing buses", async () => {
    const { repository } = setup([{ data: null, error: { message: "buses failed" } }]);
    await expectDatabaseError(repository.listBuses(), "Error while accessing buses data.");
  });

  test("lists stops with and without a route filter", async () => {
    const filtered = setup([{ data: [{ id: "stop-1" }], error: null }]);
    await expect(filtered.repository.listStops("route-1")).resolves.toHaveLength(1);
    expect(filtered.queries[0].eq).toHaveBeenCalledWith("route_id", "route-1");

    const unfiltered = setup([{ data: null, error: null }]);
    await expect(unfiltered.repository.listStops()).resolves.toEqual([]);
    expect(unfiltered.queries[0].eq).not.toHaveBeenCalled();
  });

  test("maps errors while listing stops", async () => {
    const { repository } = setup([{ error: { message: "stops failed" } }]);
    await expectDatabaseError(repository.listStops(), "Error while accessing stops data.");
  });

  test.each([
    ["getStopById", ["stop-1"], { id: "stop-1" }, "stops", "Error while accessing stop data."],
    ["createStop", [{ name: "Central" }], { id: "stop-1" }, "stops", "Error while creating stop data."],
    ["updateStop", ["stop-1", { name: "North" }], { id: "stop-1" }, "stops", "Error while updating stop data."],
    ["deleteStop", ["stop-1"], { id: "stop-1" }, "stops", "Error while deleting stop data."],
    ["getIncidentById", ["report-1"], { id: "report-1" }, "reports", "Error while accessing incident data."],
  ])("handles success, null and errors for %s", async (method, args, row, table, errorMessage) => {
    const success = setup([{ data: row, error: null }]);
    await expect(success.repository[method](...args)).resolves.toEqual(row);
    expect(success.client.from).toHaveBeenCalledWith(table);

    if (method !== "createStop") {
      const empty = setup([{ data: null, error: null }]);
      await expect(empty.repository[method](...args)).resolves.toBeNull();
    }

    const failure = setup([{ data: null, error: { message: `${method} failed` } }]);
    await expectDatabaseError(failure.repository[method](...args), errorMessage);
  });

  test("lists incidents with optional moderation filtering", async () => {
    const filtered = setup([{ data: [{ id: "report-1" }], error: null }]);
    await filtered.repository.listIncidents("approved");
    expect(filtered.queries[0].eq).toHaveBeenCalledWith("moderation_status", "approved");

    const empty = setup([{ data: null, error: null }]);
    await expect(empty.repository.listIncidents()).resolves.toEqual([]);
    expect(empty.queries[0].eq).not.toHaveBeenCalled();

    const failure = setup([{ error: { message: "reports failed" } }]);
    await expectDatabaseError(
      failure.repository.listIncidents(),
      "Error while accessing incidents data.",
    );
  });

  test("sets incident moderation metadata", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
    const success = setup([{ data: { id: "report-1" }, error: null }]);

    await expect(
      success.repository.setIncidentModeration("report-1", "approved", "admin-1"),
    ).resolves.toEqual({ id: "report-1" });
    expect(success.queries[0].update).toHaveBeenCalledWith({
      moderation_status: "approved",
      moderated_by: "admin-1",
      moderated_at: "2026-01-02T03:04:05.000Z",
    });

    const empty = setup([{ data: null, error: null }]);
    await expect(empty.repository.setIncidentModeration("report-1", "rejected", "admin-1"))
      .resolves.toBeNull();

    const failure = setup([{ error: { message: "moderation failed" } }]);
    await expectDatabaseError(
      failure.repository.setIncidentModeration("report-1", "approved", "admin-1"),
      "Error while updating incident data.",
    );
    jest.useRealTimers();
  });

  test("loads telemetry history with every time-filter combination", async () => {
    const ranged = setup([{ data: [{ id: "location-1" }], error: null }]);
    await ranged.repository.getTelemetryHistory("trip-1", "start", "end");
    expect(ranged.queries[0].gte).toHaveBeenCalledWith("recorded_at", "start");
    expect(ranged.queries[0].lte).toHaveBeenCalledWith("recorded_at", "end");

    const unbounded = setup([{ data: null, error: null }]);
    await expect(unbounded.repository.getTelemetryHistory("trip-1")).resolves.toEqual([]);
    expect(unbounded.queries[0].gte).not.toHaveBeenCalled();
    expect(unbounded.queries[0].lte).not.toHaveBeenCalled();

    const failure = setup([{ error: { message: "telemetry failed" } }]);
    await expectDatabaseError(
      failure.repository.getTelemetryHistory("trip-1"),
      "Error while accessing telemetry data.",
    );
  });

  test("combines active trips with their latest telemetry and drops missing locations", async () => {
    const { repository, queries } = setup([
      { data: [
        { id: "trip-1", route_id: "route-1", status: "In_Progress" },
        { id: "trip-2", route_id: "route-2", status: "In_Progress" },
      ], error: null },
      { data: { id: "location-1", latitude: 10 }, error: null },
      { data: null, error: null },
    ]);

    await expect(repository.getCurrentTelemetry()).resolves.toEqual([
      expect.objectContaining({ id: "location-1", route_id: "route-1", status: "In_Progress" }),
    ]);
    expect(queries[1].limit).toHaveBeenCalledWith(1);
  });

  test("handles empty active trips and both telemetry query failures", async () => {
    const empty = setup([{ data: null, error: null }]);
    await expect(empty.repository.getCurrentTelemetry()).resolves.toEqual([]);

    const tripFailure = setup([{ error: { message: "trip query failed" } }]);
    await expectDatabaseError(
      tripFailure.repository.getCurrentTelemetry(),
      "Error while accessing active trips data.",
    );

    const locationFailure = setup([
      { data: [{ id: "trip-1" }], error: null },
      { error: { message: "location query failed" } },
    ]);
    await expectDatabaseError(
      locationFailure.repository.getCurrentTelemetry(),
      "Error while accessing telemetry data.",
    );
  });

  test("combines users with their first role and supports role filtering", async () => {
    const filtered = setup([
      { data: [{ id: "user-1" }, { id: "user-2" }], error: null },
      { data: [
        { user_id: "user-1", role: "Driver" },
        { user_id: "user-1", role: "Admin" },
      ], error: null },
    ]);

    await expect(filtered.repository.listUsers("Driver")).resolves.toEqual([
      { id: "user-1", role: "Driver" },
      { id: "user-2", role: null },
    ]);
    expect(filtered.queries[1].eq).toHaveBeenCalledWith("role", "Driver");

    const empty = setup([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    await expect(empty.repository.listUsers()).resolves.toEqual([]);
    expect(empty.queries[1].eq).not.toHaveBeenCalled();
  });

  test("maps independent user and role query failures", async () => {
    const usersFailure = setup([
      { error: { message: "users failed" } },
      { data: [], error: null },
    ]);
    await expectDatabaseError(
      usersFailure.repository.listUsers(),
      "Error while accessing users data.",
    );

    const rolesFailure = setup([
      { data: [], error: null },
      { error: { message: "roles failed" } },
    ]);
    await expectDatabaseError(
      rolesFailure.repository.listUsers(),
      "Error while accessing user roles data.",
    );
  });
});
