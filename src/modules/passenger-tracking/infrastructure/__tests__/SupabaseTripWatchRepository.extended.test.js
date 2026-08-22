"use strict";

jest.mock("../../../../../database/supabaseClient", () => ({
  getServiceClient: jest.fn(),
}));

const { getServiceClient } = require("../../../../../database/supabaseClient");
const { createSupabaseMock } = require("../../../../../testUtils/supabaseMock");
const SupabaseTripWatchRepository = require("../SupabaseTripWatchRepository");

function setup(responses) {
  const mock = createSupabaseMock(responses);
  getServiceClient.mockReturnValue(mock.client);
  return mock;
}

describe("SupabaseTripWatchRepository remaining operations", () => {
  const repository = new SupabaseTripWatchRepository();
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  test("gets a stop or null and maps lookup errors", async () => {
    setup([{ data: { id: "stop-1" }, error: null }]);
    await expect(repository.getStopById("stop-1")).resolves.toEqual({ id: "stop-1" });

    setup([{ data: null, error: null }]);
    await expect(repository.getStopById("missing")).resolves.toBeNull();

    setup([{ error: { message: "stop failed" } }]);
    await expect(repository.getStopById("stop-1")).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      details: "stop failed",
    });
  });

  test("finds a watch or null and maps lookup errors", async () => {
    setup([{ data: { id: "watch-1" }, error: null }]);
    await expect(repository.findWatch("user-1", "trip-1"))
      .resolves.toEqual({ id: "watch-1" });

    setup([{ data: null, error: null }]);
    await expect(repository.findWatch("user-1", "trip-1")).resolves.toBeNull();

    setup([{ error: { message: "watch failed" } }]);
    await expect(repository.findWatch("user-1", "trip-1")).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      details: "watch failed",
    });
  });

  test("keeps an existing watch for the same stop", async () => {
    const existing = { id: "watch-1", stop_id: "stop-1" };
    const { client } = setup([{ data: existing, error: null }]);
    await expect(repository.addWatch("user-1", "trip-1", "stop-1"))
      .resolves.toEqual({ watch: existing, created: false });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  test("redirects an existing watch to a different stop", async () => {
    const existing = { id: "watch-1", stop_id: "stop-1" };
    const updated = { ...existing, stop_id: "stop-2" };
    const { queries } = setup([
      { data: existing, error: null },
      { data: updated, error: null },
    ]);
    await expect(repository.addWatch("user-1", "trip-1", "stop-2"))
      .resolves.toEqual({ watch: updated, created: false });
    expect(queries[1].update).toHaveBeenCalledWith({
      stop_id: "stop-2",
      status: "waiting",
      alerted_at: null,
    });
  });

  test("creates a new watch", async () => {
    const created = { id: "watch-1", stop_id: "stop-1" };
    const { queries } = setup([
      { data: null, error: null },
      { data: created, error: null },
    ]);
    await expect(repository.addWatch("user-1", "trip-1", "stop-1"))
      .resolves.toEqual({ watch: created, created: true });
    expect(queries[1].insert).toHaveBeenCalledWith({
      user_id: "user-1",
      trip_id: "trip-1",
      stop_id: "stop-1",
      status: "waiting",
    });
  });

  test.each([
    [
      [{ data: { id: "watch-1", stop_id: "old" }, error: null }, { error: { message: "update failed" } }],
      "update failed",
    ],
    [
      [{ data: null, error: null }, { error: { message: "insert failed" } }],
      "insert failed",
    ],
  ])("maps watch write failures", async (responses, details) => {
    setup(responses);
    await expect(repository.addWatch("user-1", "trip-1", "new"))
      .rejects.toMatchObject({ code: "DATABASE_ERROR", details });
  });

  test("gets the next stop or null and maps errors", async () => {
    const found = setup([{ data: { id: "stop-2" }, error: null }]);
    await expect(repository.getNextStop("route-1", 1)).resolves.toEqual({ id: "stop-2" });
    expect(found.queries[0].gt).toHaveBeenCalledWith("stop_order", 1);

    setup([{ data: null, error: null }]);
    await expect(repository.getNextStop("route-1", 99)).resolves.toBeNull();

    setup([{ error: { message: "next failed" } }]);
    await expect(repository.getNextStop("route-1", 1)).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      details: "next failed",
    });
  });

  test("redirects a watch and logs non-blocking errors", async () => {
    setup([{ error: null }]);
    await repository.redirectWatch("watch-1", "stop-2");
    expect(consoleError).not.toHaveBeenCalled();

    setup([{ error: { message: "redirect failed" } }]);
    await repository.redirectWatch("watch-1", "stop-2");
    expect(consoleError).toHaveBeenCalledWith(
      "Error redirecting watch to next stop:",
      "redirect failed",
    );
  });

  test.each([
    ["markAsPassed", "passed", "Error updating watch status to passed:"],
    ["markAsAlerted", "alerted", "Error updating watch status:"],
  ])("updates watch status through %s", async (method, status, logMessage) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-05T06:07:08.000Z"));
    const success = setup([{ error: null }]);
    await repository[method](["watch-1"]);
    expect(success.queries[0].update).toHaveBeenCalledWith({
      status,
      alerted_at: "2026-04-05T06:07:08.000Z",
    });
    expect(success.queries[0].in).toHaveBeenCalledWith("id", ["watch-1"]);

    setup([{ error: { message: "status failed" } }]);
    await repository[method](["watch-1"]);
    expect(consoleError).toHaveBeenCalledWith(logMessage, "status failed");
    jest.useRealTimers();
  });

  test.each(["markAsPassed", "markAsAlerted"])("skips empty IDs in %s", async (method) => {
    getServiceClient.mockClear();
    await repository[method]();
    await repository[method]([]);
    expect(getServiceClient).not.toHaveBeenCalled();
  });
});
