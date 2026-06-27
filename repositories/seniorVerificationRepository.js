"use strict";

const { getServiceClient } = require("../database/supabaseClient");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const TABLE = "senior_verification_requests";
const COLUMNS =
  "id, passenger_id, document_image_bucket, document_image_path, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at";

function databaseError(error) {
  return new AppError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    "Error while accessing senior verification requests data.",
    error ? error.message : undefined,
  );
}


async function createPendingRequest(payload) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .insert(payload)
    .select(COLUMNS)
    .single();

  if (error) {
    throw databaseError(error);
  }

  return data;
}


async function listRequests(filters = {}) {
  let query = getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw databaseError(error);
  }

  return data || [];
}


async function findRequestById(id) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

async function updateRequest(id, payload) {
  const { data, error } = await getServiceClient()
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    throw databaseError(error);
  }

  return data || null;
}

async function reviewRequest(payload) {
  const { data, error } = await getServiceClient().rpc(
    "review_senior_verification_request",
    {
      p_request_id: payload.request_id,
      p_action: payload.action,
      p_reviewed_by: payload.reviewed_by || null,
      p_rejection_reason: payload.rejection_reason || null,
    },
  );

  if (error) {
    throw databaseError(error);
  }

  return data;
}

module.exports = {
  createPendingRequest,
  listRequests,
  findRequestById,
  updateRequest,
  reviewRequest,
};