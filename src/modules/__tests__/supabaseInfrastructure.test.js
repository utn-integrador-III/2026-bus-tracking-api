"use strict";

jest.mock("../../../database/supabaseClient", () => ({ getServiceClient: jest.fn() }));

const { getServiceClient } = require("../../../database/supabaseClient");
const { createSupabaseMock } = require("../../../testUtils/supabaseMock");
const SupabaseTripRepository = require("../trips/infrastructure/SupabaseTripRepository");
const SupabaseRouteRepository = require("../routes/infrastructure/SupabaseRouteRepository");
const SupabaseLocationRepository = require("../driver-trips/infrastructure/SupabaseLocationRepository");
const SupabasePassengerIncidentRepository = require(
  "../passenger-incidents/infrastructure/SupabasePassengerIncidentRepository",
);
const SupabaseUserRepository = require("../auth/infrastructure/SupabaseUserRepository");

function setup(responses) {
  const mock = createSupabaseMock(responses);
  getServiceClient.mockReturnValue(mock.client);
  return mock;
}

function failure(message = "query failed", code) {
  return { error: { message, code } };
}

describe("SupabaseTripRepository", () => {
  const repository = new SupabaseTripRepository();
  beforeEach(() => jest.clearAllMocks());

  test("lists all trips and optionally filters statuses", async () => {
    const filtered = setup([{ data: [{ id: "trip-1" }], error: null }]);
    await expect(repository.listTrips({ statuses: ["Scheduled"] })).resolves.toHaveLength(1);
    expect(filtered.queries[0].in).toHaveBeenCalledWith("status", ["Scheduled"]);

    const all = setup([{ data: null, error: null }]);
    await expect(repository.listTrips()).resolves.toEqual([]);
    expect(all.queries[0].in).not.toHaveBeenCalled();
  });

  test.each([
    ["getTripById", ["trip-1"]],
    ["updateTrip", ["trip-1", { status: "Cancelled" }]],
    ["setTripStatus", ["trip-1", "Completed"]],
  ])("returns a row or null from %s", async (method, args) => {
    setup([{ data: { id: "trip-1" }, error: null }]);
    await expect(repository[method](...args)).resolves.toEqual({ id: "trip-1" });
    setup([{ data: null, error: null }]);
    await expect(repository[method](...args)).resolves.toBeNull();
  });

  test("creates a trip", async () => {
    const payload = { route_id: "route-1" };
    const { queries } = setup([{ data: { id: "trip-1" }, error: null }]);
    await expect(repository.createTrip(payload)).resolves.toEqual({ id: "trip-1" });
    expect(queries[0].insert).toHaveBeenCalledWith(payload);
  });

  test("finds driver trips with non-empty statuses only", async () => {
    const filtered = setup([{ data: [{ id: "trip-1" }], error: null }]);
    await repository.findTripsByDriverId("driver-1", ["In_Progress"]);
    expect(filtered.queries[0].in).toHaveBeenCalledWith("status", ["In_Progress"]);

    const emptyFilter = setup([{ data: null, error: null }]);
    await expect(repository.findTripsByDriverId("driver-1", [])).resolves.toEqual([]);
    expect(emptyFilter.queries[0].in).not.toHaveBeenCalled();

    const noFilter = setup([{ data: [], error: null }]);
    await repository.findTripsByDriverId("driver-1");
    expect(noFilter.queries[0].in).not.toHaveBeenCalled();
  });

  test.each([
    ["listTrips", []],
    ["getTripById", ["trip-1"]],
    ["createTrip", [{}]],
    ["updateTrip", ["trip-1", {}]],
    ["setTripStatus", ["trip-1", "Completed"]],
    ["findTripsByDriverId", ["driver-1"]],
  ])("maps generic database errors from %s", async (method, args) => {
    setup([failure()]);
    await expect(repository[method](...args)).rejects.toMatchObject({
      statusCode: 500,
      code: "DATABASE_ERROR",
    });
  });

  test("maps foreign-key violations to a conflict", async () => {
    setup([{ error: { code: "23503", message: "invalid reference", details: "route missing" } }]);
    await expect(repository.createTrip({})).rejects.toMatchObject({
      statusCode: 409,
      code: "TRIP_REFERENCE_INVALID",
      details: "route missing",
    });

    setup([{ error: { code: "23503", message: "invalid reference" } }]);
    await expect(repository.createTrip({})).rejects.toMatchObject({
      code: "TRIP_REFERENCE_INVALID",
      details: "invalid reference",
    });
  });
});

describe("SupabaseRouteRepository", () => {
  const repository = new SupabaseRouteRepository();
  beforeEach(() => jest.clearAllMocks());

  test("filters inactive routes unless explicitly included", async () => {
    const active = setup([{ data: [{ id: "route-1" }], error: null }]);
    await repository.listRoutes({ includeInactive: false });
    expect(active.queries[0].eq).toHaveBeenCalledWith("is_active", true);

    const all = setup([{ data: null, error: null }]);
    await expect(repository.listRoutes({ includeInactive: true })).resolves.toEqual([]);
    expect(all.queries[0].eq).not.toHaveBeenCalled();
  });

  test.each([
    ["getRouteById", ["route-1"]],
    ["updateRoute", ["route-1", { name: "Route" }]],
    ["setRouteActive", ["route-1", true]],
  ])("returns data or null from %s", async (method, args) => {
    setup([{ data: { id: "route-1" }, error: null }]);
    await expect(repository[method](...args)).resolves.toEqual({ id: "route-1" });
    setup([{ data: null, error: null }]);
    await expect(repository[method](...args)).resolves.toBeNull();
  });

  test("creates a route", async () => {
    setup([{ data: { id: "route-1" }, error: null }]);
    await expect(repository.createRoute({ name: "Route" })).resolves.toEqual({ id: "route-1" });
  });

  test.each([
    ["listRoutes", [{ includeInactive: false }]],
    ["getRouteById", ["route-1"]],
    ["createRoute", [{}]],
    ["updateRoute", ["route-1", {}]],
    ["setRouteActive", ["route-1", true]],
  ])("maps database errors from %s", async (method, args) => {
    setup([failure()]);
    await expect(repository[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("SupabaseLocationRepository", () => {
  const repository = new SupabaseLocationRepository();
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  test("creates a location and mirrors realtime defaults", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-04T05:06:07.000Z"));
    const row = { id: "location-1", trip_id: "trip-1", latitude: 10, longitude: -84 };
    const { client, queries } = setup([
      { data: row, error: null },
      { data: null, error: null },
    ]);
    await expect(repository.createLocation(row)).resolves.toEqual(row);
    expect(client.from).toHaveBeenNthCalledWith(2, "trip_location");
    expect(queries[1].insert).toHaveBeenCalledWith([{
      trip_id: "trip-1",
      latitude: 10,
      longitude: -84,
      speed: null,
      heading: null,
      timestamp: "2026-03-04T05:06:07.000Z",
    }]);
    jest.useRealTimers();
  });

  test("preserves explicit realtime telemetry values", async () => {
    const row = {
      trip_id: "trip-1",
      latitude: 10,
      longitude: -84,
      speed: 0,
      heading: 90,
      recorded_at: "recorded",
    };
    const { queries } = setup([
      { data: [row], error: null },
      { data: null, error: null },
    ]);
    await repository.batchInsertLocations([row]);
    expect(queries[1].insert).toHaveBeenCalledWith([
      expect.objectContaining({ speed: 0, heading: 90, timestamp: "recorded" }),
    ]);
  });

  test("skips mirroring an empty batch and normalizes null data", async () => {
    const { client } = setup([{ data: null, error: null }]);
    await expect(repository.batchInsertLocations([])).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  test("logs mirror query errors without failing the write", async () => {
    const row = { trip_id: "trip-1", latitude: 10, longitude: -84 };
    setup([
      { data: row, error: null },
      { error: { message: "mirror failed" } },
    ]);
    await expect(repository.createLocation(row)).resolves.toEqual(row);
    expect(consoleError).toHaveBeenCalledWith(
      "Error mirroring location into trip_location:",
      "mirror failed",
    );
  });

  test("logs unexpected mirror exceptions", async () => {
    const row = { trip_id: "trip-1", latitude: 10, longitude: -84 };
    const primary = createSupabaseMock([{ data: row, error: null }]);
    getServiceClient
      .mockReturnValueOnce(primary.client)
      .mockImplementationOnce(() => { throw new Error("client failed"); });
    await expect(repository.createLocation(row)).resolves.toEqual(row);
    expect(consoleError).toHaveBeenCalledWith(
      "Error mirroring location into trip_location:",
      "client failed",
    );
  });

  test("gets the latest location or null", async () => {
    setup([{ data: { id: "location-1" }, error: null }]);
    await expect(repository.getLatestByTripId("trip-1"))
      .resolves.toEqual({ id: "location-1" });
    setup([{ data: null, error: null }]);
    await expect(repository.getLatestByTripId("trip-1")).resolves.toBeNull();
  });

  test.each([
    ["createLocation", [{ trip_id: "trip-1" }]],
    ["batchInsertLocations", [[{ trip_id: "trip-1" }]]],
    ["getLatestByTripId", ["trip-1"]],
  ])("maps primary database errors from %s", async (method, args) => {
    setup([failure()]);
    await expect(repository[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("SupabasePassengerIncidentRepository", () => {
  const repository = new SupabasePassengerIncidentRepository();
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ["createPassengerIncident", [{ trip_id: "trip-1" }], { id: "report-1" }],
    ["findIncidentsByTripId", ["trip-1"], [{ id: "report-1" }]],
    ["findIncidentsByTripIdSince", ["trip-1", "since"], [{ id: "report-1" }]],
  ])("returns data from %s", async (method, args, data) => {
    setup([{ data, error: null }]);
    await expect(repository[method](...args)).resolves.toEqual(data);
  });

  test.each([
    ["findIncidentsByTripId", ["trip-1"]],
    ["findIncidentsByTripIdSince", ["trip-1", "since"]],
  ])("normalizes empty lists from %s", async (method, args) => {
    setup([{ data: null, error: null }]);
    await expect(repository[method](...args)).resolves.toEqual([]);
  });

  test.each([
    ["createPassengerIncident", [{}]],
    ["findIncidentsByTripId", ["trip-1"]],
    ["findIncidentsByTripIdSince", ["trip-1", "since"]],
  ])("maps database errors from %s", async (method, args) => {
    setup([failure()]);
    await expect(repository[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});

describe("SupabaseUserRepository", () => {
  const repository = new SupabaseUserRepository();
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ["findUserById", ["user-1"]],
    ["findUserByEmail", ["user@example.test"]],
  ])("returns a user or null from %s", async (method, args) => {
    setup([{ data: { id: "user-1" }, error: null }]);
    await expect(repository[method](...args)).resolves.toEqual({ id: "user-1" });
    setup([{ data: null, error: null }]);
    await expect(repository[method](...args)).resolves.toBeNull();
  });

  test("creates a user", async () => {
    setup([{ data: { id: "user-1" }, error: null }]);
    await expect(repository.createUserProfile({ id: "user-1" }))
      .resolves.toEqual({ id: "user-1" });
  });

  test.each([
    ["findUserById", ["user-1"]],
    ["findUserByEmail", ["user@example.test"]],
    ["createUserProfile", [{}]],
  ])("maps database errors from %s", async (method, args) => {
    setup([failure()]);
    await expect(repository[method](...args)).rejects.toMatchObject({ code: "DATABASE_ERROR" });
  });
});
