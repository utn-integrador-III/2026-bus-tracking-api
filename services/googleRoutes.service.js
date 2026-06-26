"use strict";

const { env, assertGoogleMapsConfig } = require("../config/env");
const AppError = require("../utils/AppError");
const { HTTP_STATUS } = require("../constants/httpStatus");
const { ERROR_CODES } = require("../constants/errorCodes");

const FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

function buildGoogleRoutesBody(payload) {
  return {
    origin: {
      location: {
        latLng: {
          latitude: payload.origin.latitude,
          longitude: payload.origin.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: payload.destination.latitude,
          longitude: payload.destination.longitude,
        },
      },
    },
    travelMode: "DRIVE",
  };
}

function presentGoogleRoute(data) {
  const route = data.routes && data.routes.length > 0 ? data.routes[0] : null;

  if (!route) {
    return null;
  }

  return {
    distance_meters: route.distanceMeters,
    duration: route.duration,
    encoded_polyline: route.polyline ? route.polyline.encodedPolyline : null,
  };
}

async function computeRoute(payload) {
  assertGoogleMapsConfig();

  const response = await fetch(env.googleRoutesApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.googleMapsApiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(buildGoogleRoutesBody(payload)),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.GOOGLE_ROUTES_ERROR,
      "Google Routes API request failed.",
      data,
    );
  }

  const route = presentGoogleRoute(data);

  if (!route) {
    throw new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.GOOGLE_ROUTE_NOT_FOUND,
      "Google Routes API did not return a route.",
    );
  }

  return route;
}

module.exports = {
  computeRoute,
  buildGoogleRoutesBody,
  presentGoogleRoute,
};