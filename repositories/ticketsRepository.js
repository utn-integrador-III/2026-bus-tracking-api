"use strict";

const { createClient } = require("@supabase/supabase-js");
const { env } = require("../config/env");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");

const TABLE = "tickets";
const COLUMNS =
  "id, passenger_id, trip_id, status, payment_type, generated_at, scanned_at, qr_token, scanned_by, qr_payload, created_at";

let supabase = null;

function getSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  const supabaseUrl = env.supabaseUrl;

  const supabaseKey =
    env.supabaseServiceRoleKey ||
    env.supabaseServiceKey ||
    env.supabaseAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "SUPABASE_CLIENT_NOT_CONFIGURED",
      "Supabase URL or key is not configured for ticketsRepository.",
    );
  }

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabase;
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
}

module.exports = new TicketsRepository();
module.exports.TicketsRepository = TicketsRepository;