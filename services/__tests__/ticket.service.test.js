"use strict";

const {
  TicketService,
  createTicketModule,
} = require("../../src/modules/tickets");

const PASSENGER_ID = "15740dd7-9b7f-4838-aaf8-b59141e7edac";
const TRIP_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const TICKET_ID = "9f2504e0-4f89-41d3-9a0c-0305e82c3309";

describe("TicketService", () => {
  let tripRepository;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.TICKET_QR_SECRET = "test-ticket-secret";
    tripRepository = {
      getTripById: jest
        .fn()
        .mockResolvedValue({ id: TRIP_ID, status: "In_Progress" }),
    };
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
      findGeneratedByPassengerAndTrip: jest.fn().mockResolvedValue(null),
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

    const service = new TicketService({
      ticketRepository,
      passengerRepository,
      tripRepository,
    });

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
      fare: 500,
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

  test("rejects a second checkout for the same passenger and trip", async () => {
    const existingTicket = {
      id: TICKET_ID,
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Mock",
      qr_payload: "secure_payload",
      qr_token: "token",
      generated_at: "2026-07-01T00:00:00.000Z",
      created_at: "2026-07-01T00:00:00.000Z",
    };

    const ticketRepository = {
      findGeneratedByPassengerAndTrip: jest
        .fn()
        .mockResolvedValue(existingTicket),
      createTicket: jest.fn(),
      updateTicketQrPayload: jest.fn(),
    };

    const passengerRepository = {
      findPassengerById: jest.fn().mockResolvedValue({ is_senior: false }),
    };

    const service = new TicketService({
      ticketRepository,
      passengerRepository,
      tripRepository,
    });

    await expect(
      service.checkout(PASSENGER_ID, { trip_id: TRIP_ID }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "TICKET_ALREADY_GENERATED",
    });

    expect(ticketRepository.findGeneratedByPassengerAndTrip).toHaveBeenCalledWith(
      PASSENGER_ID,
      TRIP_ID,
    );
    expect(ticketRepository.createTicket).not.toHaveBeenCalled();
    expect(ticketRepository.updateTicketQrPayload).not.toHaveBeenCalled();
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
      findGeneratedByPassengerAndTrip: jest.fn().mockResolvedValue(null),
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

    const service = new TicketService({
      ticketRepository,
      passengerRepository,
      tripRepository,
    });

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
      fare: 500,
      qr_payload: "pending",
    });

    expect(ticket.payment_type).toBe("Mock");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test.each(["Completed", "Cancelled"])(
    "rejects checkout for a trip in status %s",
    async (status) => {
      tripRepository.getTripById.mockResolvedValue({ id: TRIP_ID, status });

      const ticketRepository = {
        createTicket: jest.fn(),
        updateTicketQrPayload: jest.fn(),
      };

      const passengerRepository = {
        findPassengerById: jest.fn(),
      };

      const service = new TicketService({
        ticketRepository,
        passengerRepository,
        tripRepository,
      });

      await expect(
        service.checkout(PASSENGER_ID, { trip_id: TRIP_ID }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "TICKET_TRIP_NOT_AVAILABLE",
      });

      expect(ticketRepository.createTicket).not.toHaveBeenCalled();
    },
  );

  test("rejects checkout when the trip does not exist", async () => {
    tripRepository.getTripById.mockResolvedValue(null);

    const ticketRepository = {
      createTicket: jest.fn(),
      updateTicketQrPayload: jest.fn(),
    };

    const passengerRepository = {
      findPassengerById: jest.fn(),
    };

    const service = new TicketService({
      ticketRepository,
      passengerRepository,
      tripRepository,
    });

    await expect(
      service.checkout(PASSENGER_ID, { trip_id: TRIP_ID }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TRIP_NOT_FOUND",
    });

    expect(ticketRepository.createTicket).not.toHaveBeenCalled();
  });

  test("forwards the injected passengerRepository through createTicketModule", () => {
    const ticketRepository = {};
    const passengerRepository = { findPassengerById: jest.fn() };

    const { ticketService } = createTicketModule({
      ticketRepository,
      passengerRepository,
    });

    expect(ticketService.ticketRepository).toBe(ticketRepository);
    expect(ticketService.passengerRepository).toBe(passengerRepository);
  });

  test("forwards the injected passengerRepository through createTicketModule", () => {
    const ticketRepository = {};
    const passengerRepository = { findPassengerById: jest.fn() };

    const { ticketService } = createTicketModule({
      ticketRepository,
      passengerRepository,
    });

    expect(ticketService.ticketRepository).toBe(ticketRepository);
    expect(ticketService.passengerRepository).toBe(passengerRepository);
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
      findGeneratedByPassengerAndTrip: jest.fn().mockResolvedValue(null),
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

    const service = new TicketService({
      ticketRepository,
      passengerRepository,
      tripRepository,
    });

    const ticket = await service.checkout(PASSENGER_ID, {
      trip_id: TRIP_ID,
    });

    expect(ticketRepository.createTicket).toHaveBeenCalledWith({
      passenger_id: PASSENGER_ID,
      trip_id: TRIP_ID,
      status: "Generated",
      payment_type: "Senior_Exemption",
      fare: 0,
      qr_payload: "pending",
    });

    expect(ticket.payment_type).toBe("Senior_Exemption");
  });
});