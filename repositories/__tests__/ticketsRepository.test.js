"use strict";

jest.mock("../../database/supabaseClient", () => ({ getServiceClient: jest.fn() }));

const { getServiceClient } = require("../../database/supabaseClient");
const { createSupabaseMock } = require("../../testUtils/supabaseMock");
const repository = require("../ticketsRepository");

function setup(responses) {
  const mock = createSupabaseMock(responses);
  getServiceClient.mockReturnValue(mock.client);
  return mock;
}

describe("ticketsRepository", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates a ticket", async () => {
    const { queries } = setup([{ data: { id: "ticket-1" }, error: null }]);
    await expect(repository.createTicket({ trip_id: "trip-1" }))
      .resolves.toEqual({ id: "ticket-1" });
    expect(queries[0].insert).toHaveBeenCalledWith({ trip_id: "trip-1" });
  });

  test.each([
    [{ code: "23503" }, 409, "TICKET_REFERENCE_INVALID"],
    [{ code: "23502", message: "fare is required" }, 500, "TICKET_REQUIRED_FIELD_MISSING"],
    [{ code: "OTHER", message: "database unavailable" }, 500, "TICKET_REPOSITORY_ERROR"],
    [{}, 500, "TICKET_REPOSITORY_ERROR"],
  ])("maps create errors %#", async (error, statusCode, code) => {
    setup([{ error }]);
    await expect(repository.createTicket({})).rejects.toMatchObject({ statusCode, code });
  });

  test("finds the latest generated ticket or null", async () => {
    const found = setup([{ data: { id: "ticket-1" }, error: null }]);
    await expect(repository.findGeneratedByPassengerAndTrip("passenger-1", "trip-1"))
      .resolves.toEqual({ id: "ticket-1" });
    expect(found.queries[0].eq).toHaveBeenCalledTimes(3);
    expect(found.queries[0].limit).toHaveBeenCalledWith(1);

    setup([{ data: null, error: null }]);
    await expect(repository.findGeneratedByPassengerAndTrip("passenger-1", "trip-1"))
      .resolves.toBeNull();
  });

  test("maps errors finding a generated ticket", async () => {
    setup([{ error: { message: "lookup failed" } }]);
    await expect(repository.findGeneratedByPassengerAndTrip("passenger-1", "trip-1"))
      .rejects.toMatchObject({ code: "TICKET_REPOSITORY_ERROR" });
  });

  test("lists passenger tickets and normalizes empty data", async () => {
    const found = setup([{ data: [{ id: "ticket-1" }], error: null }]);
    await expect(repository.findByPassengerId("passenger-1")).resolves.toHaveLength(1);
    expect(found.queries[0].order).toHaveBeenCalledWith("created_at", { ascending: false });

    setup([{ data: null, error: null }]);
    await expect(repository.findByPassengerId("passenger-1")).resolves.toEqual([]);
  });

  test("maps errors listing passenger tickets", async () => {
    setup([{ error: { message: "list failed" } }]);
    await expect(repository.findByPassengerId("passenger-1"))
      .rejects.toMatchObject({ code: "TICKET_REPOSITORY_ERROR" });
  });

  test("updates ticket QR data", async () => {
    const { queries } = setup([{ data: { id: "ticket-1" }, error: null }]);
    await expect(repository.updateTicketQrPayload("ticket-1", "payload", "token"))
      .resolves.toEqual({ id: "ticket-1" });
    expect(queries[0].update).toHaveBeenCalledWith({ qr_payload: "payload", qr_token: "token" });
  });

  test("maps QR update errors", async () => {
    setup([{ error: { message: "update failed" } }]);
    await expect(repository.updateTicketQrPayload("ticket-1", "payload", "token"))
      .rejects.toMatchObject({ code: "TICKET_REPOSITORY_ERROR" });
  });

  test("scans a ticket through the atomic RPC", async () => {
    const { client } = setup([{ data: { id: "ticket-1", status: "Used" }, error: null }]);
    await expect(repository.scanTicketAtomic("ticket-1", "driver-1", "trip-1"))
      .resolves.toMatchObject({ status: "Used" });
    expect(client.rpc).toHaveBeenCalledWith("scan_ticket", {
      p_ticket_id: "ticket-1",
      p_driver_id: "driver-1",
      p_active_trip_id: "trip-1",
    });
  });

  test.each([
    ["TICKET_NOT_FOUND", 404, "TICKET_NOT_FOUND"],
    ["TICKET_TRIP_MISMATCH", 409, "TICKET_TRIP_MISMATCH"],
    ["TICKET_ALREADY_SCANNED", 409, "TICKET_ALREADY_SCANNED"],
    ["unknown scan failure", 500, "TICKET_SCAN_FAILED"],
  ])("maps scan RPC error %s", async (message, statusCode, code) => {
    setup([{ error: { message } }]);
    await expect(repository.scanTicketAtomic("ticket-1", "driver-1", "trip-1"))
      .rejects.toMatchObject({ statusCode, code });
  });

  test("uses scan error details and the default fallback message", async () => {
    setup([{ error: { details: "TICKET_NOT_FOUND" } }]);
    await expect(repository.scanTicketAtomic("ticket-1", "driver-1", "trip-1"))
      .rejects.toMatchObject({ code: "TICKET_NOT_FOUND" });

    setup([{ error: {} }]);
    await expect(repository.scanTicketAtomic("ticket-1", "driver-1", "trip-1"))
      .rejects.toMatchObject({ code: "TICKET_SCAN_FAILED", message: "Error al escanear el ticket." });
  });
});
