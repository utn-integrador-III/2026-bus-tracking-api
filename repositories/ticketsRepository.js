"use strict";

const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");

const TABLE = "tickets";
const COLUMNS =
  "id, passenger_id, trip_id, status, payment_type, generated_at, scanned_at, qr_token, scanned_by, qr_payload, created_at";
const STATUS_GENERATED = "Generated";

let supabase = null;

const { getServiceClient } = require("../database/supabaseClient");

function getSupabaseClient() {
  return getServiceClient();
}

function mapTicketError(error) {
  if (error?.code === "23503") {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      "TICKET_REFERENCE_INVALID",
      "passenger_id or trip_id does not match an existing record.",
    );
  }

  if (error?.code === "23502") {
    return new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "TICKET_REQUIRED_FIELD_MISSING",
      error.message || "A required ticket field is missing.",
    );
  }

  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    "TICKET_REPOSITORY_ERROR",
    error.message || "Error while accessing ticket data.",
  );
}

function mapScanRpcError(error) {
  const message = error?.message || error?.details || "";

  if (message.includes("TICKET_NOT_FOUND")) {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      "TICKET_NOT_FOUND",
      "El ticket especificado no existe.",
    );
  }

  if (message.includes("TICKET_TRIP_MISMATCH")) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      "TICKET_TRIP_MISMATCH",
      "El ticket no corresponde al viaje activo del conductor.",
    );
  }

  if (message.includes("TICKET_ALREADY_SCANNED")) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      "TICKET_ALREADY_SCANNED",
      "El ticket ya fue escaneado anteriormente.",
    );
  }

  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    "TICKET_SCAN_FAILED",
    message || "Error al escanear el ticket.",
  );
}

class TicketsRepository {
  async createTicket(payload) {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from(TABLE)
      .insert(payload)
      .select(COLUMNS)
      .single();

    if (error) {
      throw mapTicketError(error);
    }

    return data;
  }

  async findGeneratedByPassengerAndTrip(passengerId, tripId) {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from(TABLE)
      .select(COLUMNS)
      .eq("passenger_id", passengerId)
      .eq("trip_id", tripId)
      .eq("status", STATUS_GENERATED)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw mapTicketError(error);
    }

    return data || null;
  }

  async findByPassengerId(passengerId) {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from(TABLE)
      .select(COLUMNS)
      .eq("passenger_id", passengerId)
      .order("created_at", { ascending: false });

    if (error) {
      throw mapTicketError(error);
    }

    return data || [];
  }

  async updateTicketQrPayload(ticketId, qrPayload, qrToken) {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from(TABLE)
      .update({
        qr_payload: qrPayload,
        qr_token: qrToken,
      })
      .eq("id", ticketId)
      .select(COLUMNS)
      .single();

    if (error) {
      throw mapTicketError(error);
    }

    return data;
  }

  async scanTicketAtomic(ticketId, driverId, activeTripId) {
    const client = getSupabaseClient();

    const { data, error } = await client
      .rpc("scan_ticket", {
        p_ticket_id: ticketId,
        p_driver_id: driverId,
        p_active_trip_id: activeTripId,
      })
      .maybeSingle();

    if (error) {
      throw mapScanRpcError(error);
    }

    return data;
  }
}

module.exports = new TicketsRepository();
module.exports.TicketsRepository = TicketsRepository;