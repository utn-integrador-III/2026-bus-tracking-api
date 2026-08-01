"use strict";

const crypto = require("crypto");
const express = require("express");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const requireRole = require("../../../middleware/requireRole");
const { ROLES } = require("../../../constants/roles");
const { checkoutTicketSchema, scanTicketSchema } = require("../../../models/ticket.model");
const ticketsRepository = require("../../../repositories/ticketsRepository");
const passengerRepository = require("../../../repositories/passengerRepository");

const CHECKOUT_DELAY_MS = 1500;
const TICKET_STATUS_GENERATED = "Generated";
const TICKET_PAYMENT_TYPE_MOCK = "Mock";
const TICKET_PAYMENT_TYPE_SENIOR = "Senior_Exemption";

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getQrSecret() {
  return (
    process.env.TICKET_QR_SECRET ||
    process.env.JWT_SECRET ||
    "local-ticket-secret"
  );
}

function generateSecureQrPayload(ticketId, passengerId, tripId, qrToken) {
  const issuedAt = new Date().toISOString();

  const payload = {
    ticket_id: ticketId,
    passenger_id: passengerId,
    trip_id: tripId,
    status: TICKET_STATUS_GENERATED,
    qr_token: qrToken,
    issued_at: issuedAt,
  };

  const signature = crypto
    .createHmac("sha256", getQrSecret())
    .update(JSON.stringify(payload))
    .digest("hex");

  return Buffer.from(
    JSON.stringify({
      ...payload,
      signature,
    }),
  ).toString("base64url");
}

class TicketService {
  constructor(dependencies = {}) {
    this.ticketRepository = dependencies.ticketRepository || ticketsRepository;
    this.driverTripService = dependencies.driverTripService || null;
    this.passengerRepository = dependencies.passengerRepository || passengerRepository;
  }

  async scanTicket(driverId, ticketId) {
    if (!this.driverTripService) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
        "Driver trip service is not available.",
      );
    }

    const activeTrip = await this.driverTripService.getActiveTrip(driverId);

    if (!activeTrip) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN_ROLE,
        "Driver has no active trip.",
      );
    }

    return this.ticketRepository.scanTicketAtomic(
      ticketId,
      driverId,
      activeTrip.id,
    );
  }

  async isSeniorPassenger(passengerId) {
    try {
      const passenger = await this.passengerRepository.findPassengerById(passengerId);
      return passenger ? passenger.is_senior === true : false;
    } catch (error) {
      console.error(
        "Error reading passenger profile during checkout:",
        error.message,
      );
      return false;
    }
  }

  async checkout(passengerId, payload) {
    const isSenior = await this.isSeniorPassenger(passengerId);

    if (!isSenior) {
      await wait(CHECKOUT_DELAY_MS);
    }

    const draftTicket = await this.ticketRepository.createTicket({
      passenger_id: passengerId,
      trip_id: payload.trip_id,
      status: TICKET_STATUS_GENERATED,
      payment_type: isSenior ? TICKET_PAYMENT_TYPE_SENIOR : TICKET_PAYMENT_TYPE_MOCK,
      qr_payload: "pending",
    });

    const qrToken = crypto.randomBytes(32).toString("base64url");

    const qrPayload = generateSecureQrPayload(
      draftTicket.id,
      passengerId,
      payload.trip_id,
      qrToken,
    );

    return this.ticketRepository.updateTicketQrPayload(
      draftTicket.id,
      qrPayload,
      qrToken,
    );
  }

  async listByPassenger(passengerId) {
    return this.ticketRepository.findByPassengerId(passengerId);
  }
}

class TicketController {
  constructor(service) {
    this.service = service;
    this.checkout = asyncHandler(this.checkout.bind(this));
    this.listMine = asyncHandler(this.listMine.bind(this));
    this.scan = asyncHandler(this.scan.bind(this));
  }

  async scan(req, res) {
    const driverId = req.auth.userId;

    if (!driverId) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        "Authenticated driver is required.",
      );
    }

    const ticket = await this.service.scanTicket(
      driverId,
      req.valid.body.ticket_id,
    );

    res.status(HTTP_STATUS.OK).json(ticket);
  }

  async checkout(req, res) {
    const passengerId = req.auth.userId;

    if (!passengerId) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        "Authenticated passenger is required.",
      );
    }

    const ticket = await this.service.checkout(passengerId, req.valid.body);

    res.status(HTTP_STATUS.CREATED).json(ticket);
  }

  async listMine(req, res) {
    const passengerId = req.auth.userId;

    if (!passengerId) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        "Authenticated passenger is required.",
      );
    }

    const tickets = await this.service.listByPassenger(passengerId);

    res.status(HTTP_STATUS.OK || 200).json(tickets);
  }
}

function createTicketModule(dependencies = {}) {
  const ticketService =
    dependencies.ticketService ||
    new TicketService({
      ticketRepository: dependencies.ticketRepository,
      driverTripService: dependencies.driverTripService,
    });

  const ticketController =
    dependencies.ticketController || new TicketController(ticketService);

  return {
    ticketService,
    ticketController,
  };
}

function createTicketsRouter(dependencies = {}) {
  const { ticketController } = createTicketModule(dependencies);
  const router = express.Router();

  router.use(requireAuth);

  router.get("/my", ticketController.listMine);

  router.post(
    "/checkout",
    validate({ body: checkoutTicketSchema }),
    ticketController.checkout,
  );

  router.post(
    "/scan",
    requireRole(ROLES.DRIVER),
    validate({ body: scanTicketSchema }, ERROR_CODES.TICKET_SCAN_FAILED),
    ticketController.scan,
  );

  return router;
}

module.exports = {
  TicketService,
  TicketController,
  createTicketModule,
  createTicketsRouter,
};