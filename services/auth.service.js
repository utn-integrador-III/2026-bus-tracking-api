"use strict";

const { createAuthModule } = require("../src/modules/auth");
const { getServiceClient } = require("../database/supabaseClient");
const userRepository = require("../repositories/userRepository");
const userRoleRepository = require("../repositories/userRoleRepository");
const passengerRepository = require("../repositories/passengerRepository");
const seniorVerificationRepository = require("../repositories/seniorVerificationRepository");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const DRIVER_ROLE = "Driver";
const SENIOR_DOCUMENTS_BUCKET = "cedulas";
const SENIOR_DOCUMENT_CONTENT_TYPES = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

function normalizeStorageSegment(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function buildSeniorDocumentPath(payload) {
  const owner = normalizeStorageSegment(payload.user_id, "passenger");
  const rawFileName = normalizeStorageSegment(payload.file_name, "document");
  const baseName = rawFileName.replace(/\.[a-z0-9]+$/i, "") || "document";
  const extension = SENIOR_DOCUMENT_CONTENT_TYPES[payload.content_type];

  return `passengers/${owner}/${Date.now()}-${baseName}.${extension}`;
}

const { authService } = createAuthModule();

const baseRegisterPassenger = authService.registerPassenger.bind(authService);

authService.createSeniorDocumentUploadUrl = async function createSeniorDocumentUploadUrl(payload) {
  const path = buildSeniorDocumentPath(payload);
  const { data, error } = await getServiceClient()
    .storage
    .from(SENIOR_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data || !data.signedUrl || !data.path) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.AUTH_SENIOR_DOCUMENT_UPLOAD_FAILED,
      "Senior document upload URL could not be created.",
      error ? error.message : undefined,
    );
  }

  return {
    bucket: SENIOR_DOCUMENTS_BUCKET,
    path: data.path,
    signed_url: data.signedUrl,
    token: data.token || null,
  };
};

authService.registerPassenger = async function registerPassenger(payload) {
  const result = await baseRegisterPassenger(payload);

  const isSeniorRequest = payload.is_senior_request === true;

  if (!isSeniorRequest) {
    return {
      ...result,
      senior_verification_request: result.senior_verification_request || null,
    };
  }

  const userId = result.user ? result.user.id : result.user_id;

  let user = result.user;
  let passenger = result.passenger;

  if (typeof userRepository.setUserActive === "function") {
    const updatedUser = await userRepository.setUserActive(userId, false);

    if (updatedUser) {
      user = {
        ...user,
        ...updatedUser,
        role: user ? user.role : updatedUser.role,
      };
    }
  }

  if (
    payload.birth_date &&
    typeof passengerRepository.updatePassengerProfile === "function"
  ) {
    const updatedPassenger = await passengerRepository.updatePassengerProfile(
      userId,
      {
        birth_date: payload.birth_date,
      },
    );

    if (updatedPassenger) {
      passenger = updatedPassenger;
    }
  }

  const seniorVerificationRequest =
    await seniorVerificationRepository.createPendingRequest({
      passenger_id: userId,
      document_image_bucket: SENIOR_DOCUMENTS_BUCKET,
      document_image_path: payload.document_image_path,
      status: "pending",
    });

  return {
    ...result,
    user: {
      ...user,
      is_active: false,
    },
    passenger,
    senior_verification_request: seniorVerificationRequest,
  };
};

authService.loginDriver = async function loginDriver(payload, context = {}) {
  const result = await authService.loginUser(payload, context);

  const driverRole = await userRoleRepository.findRoleByUserIdAndRole(
    result.user.id,
    DRIVER_ROLE,
  );

  if (!driverRole) {
    await authService.writeLoginAudit({
      user_id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      auth_strategy: "password",
      oauth_provider: null,
      was_successful: false,
      failure_code: ERROR_CODES.FORBIDDEN_ROLE,
      ip_address: context.ipAddress || null,
      user_agent: context.userAgent || null,
    });
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.FORBIDDEN_ROLE,
      "Only driver users can access this login.",
    );
  }

  return {
    ...result,
    user: {
      ...result.user,
      role: driverRole.role,
    },
  };
};

module.exports = authService;
