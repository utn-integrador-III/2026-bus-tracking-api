"use strict";

const crypto = require("crypto");
const express = require("express");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const { checkoutTicketSchema } = require("../../../models/ticket.model");
const ticketsRepository = require("../../../repositories/ticketsRepository");

const CHECKOUT_DELAY_MS = 1500;
const TICKET_STATUS_GENERATED = "Generated";

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getQrSecret() {
  return process.env.TICKET_QR_SECRET || process.env.JWT_SECRET || "local-ticket-secret";
}

function generateSecureQrPayload(ticketId, passengerId, tripId, qrToken) {  const issuedAt = new Date().toISOString();
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
  }

  async checkout(passengerId, payload) {
    await wait(CHECKOUT_DELAY_MS);

    const draftTicket = await this.ticketRepository.createTicket({
     passenger_id: passengerId,
     trip_id: payload.trip_id,
     status: TICKET_STATUS_GENERATED,
     payment_type: "Mock",
     qr_payload: "pending",
    });

    const qrToken = crypto.randomBytes(32).toString("base64url");

    const qrPayload = generateSecureQrPayload(
        draftTicket.id,
        passengerId,
        payload.trip_id,
        qrToken,
    );

    const ticket = await this.ticketRepository.updateTicketQrPayload(
        draftTicket.id,
        qrPayload,
        qrToken,
    );

    return {
      id: ticket.id,
      passenger_id: ticket.passenger_id,
      trip_id: ticket.trip_id,
      status: ticket.status,
      qr_payload: ticket.qr_payload,
      created_at: ticket.created_at,
    };
  }
}

class TicketController {
  constructor(service) {
    this.service = service;
    this.checkout = asyncHandler(this.checkout.bind(this));
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
}

function createTicketModule(dependencies = {}) {
  const ticketService =
    dependencies.ticketService ||
    new TicketService({
      ticketRepository: dependencies.ticketRepository,
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

  router.post(
    "/checkout",
    validate({ body: checkoutTicketSchema }),
    ticketController.checkout,
  );

  return router;
}

module.exports = {
  TicketService,
  TicketController,
  createTicketModule,
  createTicketsRouter,
};