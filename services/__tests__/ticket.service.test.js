"use strict";

const { TicketService } = require("../../src/modules/tickets");

const PASSENGER_ID = "15740dd7-9b7f-4838-aaf8-b59141e7edac";
const TRIP_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const TICKET_ID = "9f2504e0-4f89-41d3-9a0c-0305e82c3309";

describe("TicketService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    process.env.TICKET_QR_SECRET = "test-ticket-secret";
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.TICKET_QR_SECRET;
    jest.clearAllMocks();
  });

  test("creates a generated ticket and secure QR payload after simulated latency", async () => {
    const draftTicket = {
      id: TICKET_ID,
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      qr_payload: "pending",
      created_at: "2026-07-01T00:00:00.000Z",
    };

    const ticketRepository = {
      createTicket: jest.fn().mockResolvedValue(draftTicket),
      updateTicketQrPayload: jest.fn().mockImplementation((ticketId, qrPayload) =>
        Promise.resolve({
          ...draftTicket,
          id: ticketId,
          qr_payload: qrPayload,
        }),
      ),
    };

    const service = new TicketService({ ticketRepository });

    const checkoutPromise = service.checkout(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });

    await jest.advanceTimersByTimeAsync(1500);

    const ticket = await checkoutPromise;

    expect(ticketRepository.createTicket).toHaveBeenCalledWith({
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      qr_payload: "pending",
    });

    expect(ticketRepository.updateTicketQrPayload).toHaveBeenCalledWith(
      TICKET_ID,
      expect.any(String),
    );

    expect(ticket.id).toBe(TICKET_ID);
    expect(ticket.passenger_id).toBe(PASSENGER_ID);
    expect(ticket.trip_id).toBe(TRIP_ID);
    expect(ticket.status).toBe("Generated");
    expect(ticket.qr_payload).toEqual(expect.any(String));

    const decodedPayload = JSON.parse(
      Buffer.from(ticket.qr_payload, "base64url").toString("utf8"),
    );

    expect(decodedPayload.ticket_id).toBe(TICKET_ID);
    expect(decodedPayload.passenger_id).toBe(PASSENGER_ID);
    expect(decodedPayload.trip_id).toBe(TRIP_ID);
    expect(decodedPayload.status).toBe("Generated");
    expect(decodedPayload.signature).toEqual(expect.any(String));
  });
});