"use strict";

const seniorVerificationRepository = require("../repositories/seniorVerificationRepository");
const passengerRepository = require("../repositories/passengerRepository");
const userRepository = require("../repositories/userRepository");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

function notFound() {
  return new AppError(
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.SENIOR_VERIFICATION_NOT_FOUND,
    "The requested senior verification request does not exist.",
  );
}

function alreadyReviewed() {
  return new AppError(
    HTTP_STATUS.CONFLICT,
    ERROR_CODES.SENIOR_VERIFICATION_ALREADY_REVIEWED,
    "This senior verification request has already been reviewed.",
  );
}

async function enrichRequest(request) {
  if (!request) {
    return null;
  }

  const [user, passenger, documentImageUrl] = await Promise.all([
    userRepository.findUserById(request.passenger_id),
    passengerRepository.findPassengerById(request.passenger_id),
    seniorVerificationRepository.createSignedDocumentUrl(
      request.document_image_bucket,
      request.document_image_path,
    ),
  ]);

  return {
    ...request,
    document_image_url: documentImageUrl,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          is_active: user.is_active,
          deactivated_at: user.deactivated_at,
          created_at: user.created_at,
        }
      : null,
    passenger,
  };
}

async function listRequests(filters) {
  const requests = await seniorVerificationRepository.listRequests(filters);

  return Promise.all(requests.map((request) => enrichRequest(request)));
}

async function getRequestById(id) {
  const request = await seniorVerificationRepository.findRequestById(id);

  if (!request) {
    throw notFound();
  }

  return enrichRequest(request);
}

async function approveRequest(id, payload) {
  const request = await seniorVerificationRepository.findRequestById(id);

  if (!request) {
    throw notFound();
  }

  if (request.status !== "pending") {
    throw alreadyReviewed();
  }

  await seniorVerificationRepository.reviewRequest({
    request_id: id,
    action: "approved",
    reviewed_by: payload.reviewed_by || null,
    rejection_reason: null,
  });

  return getRequestById(id);
}

async function rejectRequest(id, payload) {
  const request = await seniorVerificationRepository.findRequestById(id);

  if (!request) {
    throw notFound();
  }

  if (request.status !== "pending") {
    throw alreadyReviewed();
  }

  await seniorVerificationRepository.reviewRequest({
    request_id: id,
    action: "rejected",
    reviewed_by: payload.reviewed_by || null,
    rejection_reason: payload.rejection_reason,
  });

  return getRequestById(id);
}

module.exports = {
  listRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
};
