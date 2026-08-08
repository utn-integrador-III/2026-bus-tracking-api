"use strict";

jest.mock("../../../../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
}));

const { getServiceClient } = require("../../../../../database/supabaseClient");
const SupabaseTripWatchRepository = require("../SupabaseTripWatchRepository");

function mockResponses(responses) {
  const selections = [];

  getServiceClient.mockImplementation(() => ({
    from: () => ({
      select: (selection) => {
        selections.push(selection);
        return {
          eq: () => ({
            in: () => Promise.resolve(responses.shift()),
          }),
        };
      },
    }),
  }));

  return selections;
}

function buildRow(overrides = {}) {
  return {
    id: "watch-1",
    user_id: "user-1",
    trip_id: "trip-1",
    stop_id: "stop-1",
    status: "waiting",
    stops: { id: "stop-1", route_id: "route-1", latitude: 9.9, longitude: -84.1, stop_order: 2 },
    ...overrides,
  };
}

describe("SupabaseTripWatchRepository.getActiveWatchesForTrip", () => {
  it("uses the full embed when the geofence radius column exists", async () => {
    const selections = mockResponses([{ data: [buildRow()], error: null }]);
    const repository = new SupabaseTripWatchRepository();

    const result = await repository.getActiveWatchesForTrip("trip-1");

    expect(result).toHaveLength(1);
    expect(selections).toHaveLength(1);
    expect(selections[0]).toContain("geofence_radius_meters");
  });

  it("retries without the radius column and warns when the column is missing", async () => {
    const selections = mockResponses([
      {
        data: null,
        error: { code: "42703", message: "column stops.geofence_radius_meters does not exist" },
      },
      { data: [buildRow()], error: null },
    ]);
    const repository = new SupabaseTripWatchRepository();
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await repository.getActiveWatchesForTrip("trip-1");

    expect(result).toHaveLength(1);
    expect(selections).toHaveLength(2);
    expect(selections[0]).toContain("geofence_radius_meters");
    expect(selections[1]).not.toContain("geofence_radius_meters");

    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged).toMatchObject({
      scope: "geofence_alerts",
      event: "stops_geofence_radius_column_missing",
      trip_id: "trip-1",
    });

    spy.mockRestore();
  });

  it("still throws when the fallback query also fails", async () => {
    mockResponses([
      { data: null, error: { code: "42703", message: "column geofence_radius_meters does not exist" } },
      { data: null, error: { code: "PGRST200", message: "could not find a relationship" } },
    ]);
    const repository = new SupabaseTripWatchRepository();
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(repository.getActiveWatchesForTrip("trip-1")).rejects.toMatchObject({
      code: "DATABASE_ERROR",
    });

    spy.mockRestore();
  });

  it("throws unrelated query errors without retrying", async () => {
    const selections = mockResponses([
      { data: null, error: { code: "PGRST200", message: "could not find a relationship" } },
    ]);
    const repository = new SupabaseTripWatchRepository();

    await expect(repository.getActiveWatchesForTrip("trip-1")).rejects.toMatchObject({
      code: "DATABASE_ERROR",
    });
    expect(selections).toHaveLength(1);
  });

  it("warns when a watch row comes back with an unresolved stop embed", async () => {
    mockResponses([{ data: [buildRow({ stops: null })], error: null }]);
    const repository = new SupabaseTripWatchRepository();
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await repository.getActiveWatchesForTrip("trip-1");

    expect(result).toHaveLength(1);
    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged).toMatchObject({
      event: "stop_embed_unresolved",
      trip_id: "trip-1",
      watch_id: "watch-1",
      stop_id: "stop-1",
    });

    spy.mockRestore();
  });
});
