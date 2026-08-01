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
      payment_type: "Mock",
      qr_payload: "pending",
      qr_token: null,
      generated_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
    };

    const ticketRepository = {
      createTicket: jest.fn().mockResolvedValue(draftTicket),
      updateTicketQrPayload: jest.fn().mockImplementation(
        (ticketId, qrPayload, qrToken) =>
          Promise.resolve({
            ...draftTicket,
            id: ticketId,
            qr_payload: qrPayload,
            qr_token: qrToken,
          }),
      ),
    };

    const passengerRepository = {
      findPassengerById: jest.fn().mockResolvedValue({ is_senior: false }),
    };

    const service = new TicketService({ ticketRepository, passengerRepository });

    const checkoutPromise = service.checkout(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });

    await jest.advanceTimersByTimeAsync(1500);

    const ticket = await checkoutPromise;

    expect(ticketRepository.createTicket).toHaveBeenCalledWith({
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Mock",
      qr_payload: "pending",
    });

    expect(ticketRepository.updateTicketQrPayload).toHaveBeenCalledWith(
      TICKET_ID,
      expect.any(String),
      expect.any(String),
    );

    expect(ticket.id).toBe(TICKET_ID);
    expect(ticket.passenger_id).toBe(PASSENGER_ID);
    expect(ticket.trip_id).toBe(TRIP_ID);
    expect(ticket.status).toBe("Generated");
    expect(ticket.payment_type).toBe("Mock");
    expect(ticket.qr_payload).toEqual(expect.any(String));
    expect(ticket.qr_token).toEqual(expect.any(String));

    const decodedPayload = JSON.parse(
      Buffer.from(ticket.qr_payload, "base64url").toString("utf8"),
    );

    expect(decodedPayload.ticket_id).toBe(TICKET_ID);
    expect(decodedPayload.passenger_id).toBe(PASSENGER_ID);
    expect(decodedPayload.trip_id).toBe(TRIP_ID);
    expect(decodedPayload.status).toBe("Generated");
    expect(decodedPayload.qr_token).toEqual(expect.any(String));
    expect(decodedPayload.signature).toEqual(expect.any(String));
  });

  test("creates a new ticket every time checkout is called for the same passenger and trip", async () => {
    const firstDraftTicket = {
      id: "9f2504e0-4f89-41d3-9a0c-0305e82c3309",
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Mock",
      qr_payload: "pending",
      qr_token: null,
      generated_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
    };

    const secondDraftTicket = {
      id: "8f2504e0-4f89-41d3-9a0c-0305e82c3308",
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Mock",
      qr_payload: "pending",
      qr_token: null,
      generated_at: "2026-07-01T00:01:00.000Z",
      created_at: "2026-07-01T00:01:00.000Z",
    };

    const ticketRepository = {
      createTicket: jest
        .fn()
        .mockResolvedValueOnce(firstDraftTicket)
        .mockResolvedValueOnce(secondDraftTicket),
      updateTicketQrPayload: jest.fn().mockImplementation(
        (ticketId, qrPayload, qrToken) =>
          Promise.resolve({
            id: ticketId,
            passenger_id: PASSENGER_ID,
            trip_id: TRIP_ID,
            status: "Generated",
            payment_type: "Mock",
            qr_payload: qrPayload,
            qr_token: qrToken,
            generated_at: "2026-07-01T00:00:00.000Z",
            created_at: "2026-07-01T00:00:00.000Z",
          }),
      ),
    };

    const passengerRepository = {
      findPassengerById: jest.fn().mockResolvedValue({ is_senior: false }),
    };

    const service = new TicketService({ ticketRepository, passengerRepository });

    const firstCheckoutPromise = service.checkout(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });

    await jest.advanceTimersByTimeAsync(1500);

    const firstTicket = await firstCheckoutPromise;

    const secondCheckoutPromise = service.checkout(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });

    await jest.advanceTimersByTimeAsync(1500);

    const secondTicket = await secondCheckoutPromise;

    expect(ticketRepository.createTicket).toHaveBeenCalledTimes(2);
    expect(ticketRepository.updateTicketQrPayload).toHaveBeenCalledTimes(2);

    expect(firstTicket.id).not.toBe(secondTicket.id);
    expect(firstTicket.trip_id).toBe(secondTicket.trip_id);
    expect(firstTicket.passenger_id).toBe(secondTicket.passenger_id);
  });

  test("falls back to the non-senior path when the passenger lookup fails", async () => {
    const draftTicket = {
      id: TICKET_ID,
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Mock",
      qr_payload: "pending",
      qr_token: null,
      generated_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
    };

    const ticketRepository = {
      createTicket: jest.fn().mockResolvedValue(draftTicket),
      updateTicketQrPayload: jest.fn().mockImplementation(
        (ticketId, qrPayload, qrToken) =>
          Promise.resolve({
            ...draftTicket,
            id: ticketId,
            qr_payload: qrPayload,
            qr_token: qrToken,
          }),
      ),
    };

    const passengerRepository = {
      findPassengerById: jest
        .fn()
        .mockRejectedValue(new Error("supabase unavailable")),
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const service = new TicketService({ ticketRepository, passengerRepository });

    const checkoutPromise = service.checkout(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });

    await jest.advanceTimersByTimeAsync(1500);

    const ticket = await checkoutPromise;

    expect(ticketRepository.createTicket).toHaveBeenCalledWith({
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Mock",
      qr_payload: "pending",
    });

    expect(ticket.payment_type).toBe("Mock");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("bypasses payment delay and sets Senior_Exemption for senior passengers", async () => {
    const passengerRepository = {
      findPassengerById: jest.fn().mockResolvedValue({ is_senior: true }),
    };

    const draftTicket = {
      id: TICKET_ID,
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Senior_Exemption",
      qr_payload: "pending",
      qr_token: null,
      generated_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
    };

    const ticketRepository = {
      createTicket: jest.fn().mockResolvedValue(draftTicket),
      updateTicketQrPayload: jest.fn().mockImplementation(
        (ticketId, qrPayload, qrToken) =>
          Promise.resolve({
            ...draftTicket,
            id: ticketId,
            qr_payload: qrPayload,
            qr_token: qrToken,
          }),
      ),
    };

    const service = new TicketService({ ticketRepository, passengerRepository });

    const ticket = await service.checkout(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });

    expect(ticketRepository.createTicket).toHaveBeenCalledWith({
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Senior_Exemption",
      qr_payload: "pending",
    });

    expect(ticket.payment_type).toBe("Senior_Exemption");
  });
});