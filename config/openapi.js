"use strict";

const { ROLES } = require("../constants/roles");
const { ERROR_CODES } = require("../constants/errorCodes");
const { TRIP_STATUS_VALUES } = require("../constants/tripStatus");
const {
  ADMIN_REPORT_MODERATION_STATUS_VALUES,
} = require("../constants/adminReportModerationStatus");

const errorEnvelopeSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: {
          type: "string",
          enum: Object.values(ERROR_CODES),
        },
        message: { type: "string" },
        details: {
          type: "object",
          additionalProperties: true,
          nullable: true,
        },
      },
    },
  },
};

const positionSchema = {
  type: "array",
  minItems: 2,
  items: { type: "number" },
  example: [-84.07, 9.93],
};

const lineStringSchema = {
  type: "object",
  required: ["type", "coordinates"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["LineString"] },
    coordinates: {
      type: "array",
      minItems: 2,
      items: positionSchema,
    },
  },
};

const lineStringFeatureSchema = {
  type: "object",
  required: ["type", "geometry"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["Feature"] },
    geometry: lineStringSchema,
    properties: {
      type: "object",
      nullable: true,
      additionalProperties: true,
    },
  },
};

const routeGeometrySchema = {
  oneOf: [lineStringSchema, lineStringFeatureSchema],
  description:
    "Geometria GeoJSON de la ruta. Acepta un LineString o un Feature<LineString>. " +
    "Las posiciones son [longitud, latitud] con lng en [-180, 180] y lat en [-90, 90], minimo 2.",
};

const adminRouteSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "origin",
    "destination",
    "geometry_geojson",
    "is_active",
    "created_at",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "San Jose - Puntarenas" },
    origin: { type: "string", example: "San Jose" },
    destination: { type: "string", example: "Puntarenas" },
    geometry_geojson: { $ref: "#/components/schemas/RouteGeometry" },
    is_active: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
  },
};

const consumerRouteSchema = {
  type: "object",
  required: ["id", "name", "origin", "destination", "status", "geometry_geojson"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "San Jose - Puntarenas" },
    origin: { type: "string", example: "San Jose" },
    destination: { type: "string", example: "Puntarenas" },
    status: { type: "string", enum: ["Active", "Inactive"] },
    geometry_geojson: { $ref: "#/components/schemas/RouteGeometry" },
  },
};

const createRouteRequestSchema = {
  type: "object",
  required: ["name", "origin", "destination", "geometry_geojson"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 255 },
    origin: { type: "string", minLength: 1, maxLength: 255 },
    destination: { type: "string", minLength: 1, maxLength: 255 },
    geometry_geojson: { $ref: "#/components/schemas/RouteGeometry" },
  },
  example: {
    name: "San Jose - Puntarenas",
    origin: "San Jose",
    destination: "Puntarenas",
    geometry_geojson: {
      type: "LineString",
      coordinates: [
        [-84.07, 9.93],
        [-84.75, 9.98],
      ],
    },
  },
};

const updateRouteRequestSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 255 },
    origin: { type: "string", minLength: 1, maxLength: 255 },
    destination: { type: "string", minLength: 1, maxLength: 255 },
    geometry_geojson: { $ref: "#/components/schemas/RouteGeometry" },
  },
  example: { name: "San Jose - Puntarenas (revisada)" },
};

const tripStatusSchema = {
  type: "string",
  enum: TRIP_STATUS_VALUES,
};

const adminTripSchema = {
  type: "object",
  required: [
    "id",
    "route_id",
    "bus_id",
    "driver_id",
    "departure_time",
    "status",
    "created_at",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    route_id: { type: "string", format: "uuid" },
    bus_id: { type: "string", format: "uuid" },
    driver_id: { type: "string", format: "uuid" },
    departure_time: { type: "string", format: "date-time" },
    arrival_time: { type: "string", format: "date-time", nullable: true },
    status: { $ref: "#/components/schemas/TripStatus" },
    status_reason: { type: "string", nullable: true },
    status_metadata: { type: "object", additionalProperties: true },
    status_changed_by: { type: "string", format: "uuid", nullable: true },
    status_changed_at: { type: "string", format: "date-time", nullable: true },
    created_at: { type: "string", format: "date-time", nullable: true },
    started_at: { type: "string", format: "date-time", nullable: true },
    ended_at: { type: "string", format: "date-time", nullable: true },
  },
};

const checkoutTicketRequestSchema = {
  type: "object",
  required: ["trip_id"],
  properties: {
    trip_id: {
      type: "string",
      format: "uuid",
      example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    },
  },
};

const ticketSchema = {
  type: "object",
  required: [
    "id",
    "passenger_id",
    "trip_id",
    "status",
    "qr_payload",
    "created_at",
  ],
  properties: {
    id: {
      type: "string",
      format: "uuid",
      example: "9f2504e0-4f89-41d3-9a0c-0305e82c3309",
    },
    passenger_id: {
      type: "string",
      format: "uuid",
      example: "15740dd7-9b7f-4838-aaf8-b59141e7edac",
    },
    trip_id: {
      type: "string",
      format: "uuid",
      example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    },
    status: {
      type: "string",
      example: "Generated",
    },
    qr_payload: {
      type: "string",
      description:
        "Base64URL encoded secure QR payload generated from the ticket UUID.",
      example: "eyJ0aWNrZXRfaWQiOiI5ZjI1MDRlMC00Zjg5LTQxZDMtOWEwYy0wMzA1ZTgyYzMzMDkifQ",
    },
    created_at: {
      type: "string",
      format: "date-time",
      example: "2026-07-01T00:00:00.000Z",
    },
  },
};

const consumerTripSchema = {
  type: "object",
  required: ["id", "route_id", "bus_id", "departure_time", "status"],
  properties: {
    id: { type: "string", format: "uuid" },
    route_id: { type: "string", format: "uuid" },
    bus_id: { type: "string", format: "uuid" },
    departure_time: { type: "string", format: "date-time" },
    arrival_time: { type: "string", format: "date-time", nullable: true },
    status: { $ref: "#/components/schemas/TripStatus" },
  },
};

const createTripRequestSchema = {
  type: "object",
  required: ["route_id", "bus_id", "driver_id", "departure_time"],
  additionalProperties: false,
  properties: {
    route_id: { type: "string", format: "uuid" },
    bus_id: { type: "string", format: "uuid" },
    driver_id: { type: "string", format: "uuid" },
    departure_time: { type: "string", format: "date-time" },
    arrival_time: { type: "string", format: "date-time", nullable: true },
    status: { $ref: "#/components/schemas/TripStatus" },
  },
  example: {
    route_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    bus_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    driver_id: "1f9e2c3a-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
    departure_time: "2026-06-21T08:00:00Z",
  },
};

const updateTripRequestSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    route_id: { type: "string", format: "uuid" },
    bus_id: { type: "string", format: "uuid" },
    driver_id: { type: "string", format: "uuid" },
    departure_time: { type: "string", format: "date-time" },
    arrival_time: { type: "string", format: "date-time", nullable: true },
    status: { $ref: "#/components/schemas/TripStatus" },
    status_reason: { type: "string", minLength: 1, maxLength: 500, nullable: true },
    status_metadata: { type: "object", additionalProperties: true },
  },
  example: { status: "Delayed" },
};

const updateTripStatusRequestSchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: { $ref: "#/components/schemas/TripStatus" },
  },
  example: { status: "In Progress" },
};

const adminStopSchema = {
  type: "object",
  required: ["id", "route_id", "name", "latitude", "longitude", "stop_order"],
  properties: {
    id: { type: "string", format: "uuid" },
    route_id: { type: "string", format: "uuid" },
    name: { type: "string", example: "Parada Central" },
    latitude: { type: "number", example: 9.9763 },
    longitude: { type: "number", example: -84.8384 },
    stop_order: { type: "integer", minimum: 0, example: 1 },
    geofence_radius_meters: { type: "integer", minimum: 1, example: 500 },
  },
};

const createStopRequestSchema = {
  type: "object",
  required: ["route_id", "name", "latitude", "longitude", "stop_order"],
  additionalProperties: false,
  properties: {
    route_id: { type: "string", format: "uuid" },
    name: { type: "string", minLength: 1, maxLength: 255 },
    latitude: { type: "number", minimum: -90, maximum: 90 },
    longitude: { type: "number", minimum: -180, maximum: 180 },
    stop_order: { type: "integer", minimum: 0 },
    geofence_radius_meters: { type: "integer", minimum: 1, default: 500 },
  },
};

const updateStopRequestSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    route_id: { type: "string", format: "uuid" },
    name: { type: "string", minLength: 1, maxLength: 255 },
    latitude: { type: "number", minimum: -90, maximum: 90 },
    longitude: { type: "number", minimum: -180, maximum: 180 },
    stop_order: { type: "integer", minimum: 0 },
    geofence_radius_meters: { type: "integer", minimum: 1 },
  },
  example: { name: "Parada Central Norte" },
};

const adminIncidentSchema = {
  type: "object",
  required: [
    "id",
    "trip_id",
    "user_id",
    "type",
    "latitude",
    "longitude",
    "timestamp",
    "status",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    trip_id: { type: "string", format: "uuid" },
    user_id: { type: "string", format: "uuid" },
    type: { type: "string", example: "Traffic_Congestion" },
    description: { type: "string", nullable: true },
    latitude: { type: "number", example: 9.9763 },
    longitude: { type: "number", example: -84.8384 },
    timestamp: { type: "string", format: "date-time" },
    status: {
      type: "string",
      enum: ADMIN_REPORT_MODERATION_STATUS_VALUES,
    },
  },
};

const moderateIncidentRequestSchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ADMIN_REPORT_MODERATION_STATUS_VALUES,
    },
  },
  example: { status: "Validated" },
};

const telemetryPointSchema = {
  type: "object",
  required: ["id", "trip_id", "latitude", "longitude", "timestamp"],
  properties: {
    id: { type: "integer", format: "int64" },
    trip_id: { type: "string", format: "uuid" },
    latitude: { type: "number", example: 9.9763 },
    longitude: { type: "number", example: -84.8384 },
    speed: { type: "number", nullable: true },
    heading: { type: "number", nullable: true },
    timestamp: { type: "string", format: "date-time" },
  },
};

const currentTelemetryPointSchema = {
  type: "object",
  required: ["trip_id", "route_id", "status", "latitude", "longitude", "timestamp"],
  properties: {
    trip_id: { type: "string", format: "uuid" },
    route_id: { type: "string", format: "uuid" },
    status: { type: "string", example: "In Progress" },
    latitude: { type: "number", example: 9.9763 },
    longitude: { type: "number", example: -84.8384 },
    speed: { type: "number", nullable: true },
    heading: { type: "number", nullable: true },
    timestamp: { type: "string", format: "date-time" },
  },
};

const latLngRequestSchema = {
  type: "object",
  required: ["latitude", "longitude"],
  additionalProperties: false,
  properties: {
    latitude: {
      type: "number",
      minimum: -90,
      maximum: 90,
      example: 9.9763,
    },
    longitude: {
      type: "number",
      minimum: -180,
      maximum: 180,
      example: -84.8384,
    },
  },
};

const computeGoogleRouteRequestSchema = {
  type: "object",
  required: ["origin", "destination"],
  additionalProperties: false,
  properties: {
    origin: {
      $ref: "#/components/schemas/LatLngRequest",
    },
    destination: {
      $ref: "#/components/schemas/LatLngRequest",
    },
  },
  example: {
    origin: {
      latitude: 9.9763,
      longitude: -84.8384,
    },
    destination: {
      latitude: 9.9333,
      longitude: -84.0833,
    },
  },
};

const computeGoogleRouteResponseSchema = {
  type: "object",
  required: ["distance_meters", "duration", "encoded_polyline"],
  properties: {
    distance_meters: {
      type: "integer",
      example: 97379,
    },
    duration: {
      type: "string",
      example: "6208s",
    },
    encoded_polyline: {
      type: "string",
      nullable: true,
      example: "encoded-polyline",
    },
  },
};

const driverSchema = {
  type: "object",
  required: [
    "user_id",
    "name",
    "email",
    "role",
    "license_number",
    "isActive",
    "created_at",
  ],
  properties: {
    user_id: {
      type: "string",
      format: "uuid",
      example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    },
    name: {
      type: "string",
      example: "Carlos Gomez",
    },
    email: {
      type: "string",
      format: "email",
      example: "driver@example.com",
    },
    role: {
      type: "string",
      enum: ["Driver"],
      example: "Driver",
    },
    license_number: {
      type: "string",
      example: "B1-123456",
    },
    isActive: {
      type: "boolean",
      example: true,
    },
    created_at: {
      type: "string",
      format: "date-time",
      nullable: true,
      example: "2026-06-20T10:00:00Z",
    },
  },
};

const createDriverRequestSchema = {
  type: "object",
  required: ["name", "email", "password", "license_number"],
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      example: "Carlos Gomez",
    },
    email: {
      type: "string",
      format: "email",
      maxLength: 150,
      example: "driver@example.com",
    },
    password: {
      type: "string",
      minLength: 8,
      maxLength: 100,
      example: "Password123",
    },
    license_number: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      example: "B1-123456",
    },
  },
};

const updateDriverRequestSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      example: "Updated Driver",
    },
    email: {
      type: "string",
      format: "email",
      maxLength: 150,
      example: "updated.driver@example.com",
    },
    password: {
      type: "string",
      minLength: 8,
      maxLength: 100,
      example: "NewPassword123",
    },
    license_number: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      example: "B2-999999",
    },
  },
  example: {
    name: "Updated Driver",
    license_number: "B2-999999",
  },
};

const registerPassengerRequestSchema = {
  type: "object",
  required: ["name", "email", "password"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100, example: "Carlos Marin" },
    email: {
      type: "string",
      format: "email",
      maxLength: 150,
      example: "carlos.passenger@example.com",
    },
    password: { type: "string", minLength: 8, maxLength: 100, example: "Password123" },
    phone: { type: "string", minLength: 8, maxLength: 30, example: "88888888" },
    is_senior_request: {
      type: "boolean",
      default: false,
      example: false,
      description: "Set true when the passenger requests senior citizen verification.",
    },
    birth_date: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      example: "1960-05-10",
      description: "Required when is_senior_request is true.",
    },
    document_image_path: {
      type: "string",
      maxLength: 500,
      example: "passengers/senior.passenger@example.com/cedula.jpg",
      description: "Required when is_senior_request is true.",
    },
  },
};

const seniorDocumentUploadUrlRequestSchema = {
  type: "object",
  required: ["email", "file_name", "content_type"],
  additionalProperties: false,
  properties: {
    email: {
      type: "string",
      format: "email",
      maxLength: 150,
      example: "senior.passenger@example.com",
    },
    file_name: {
      type: "string",
      minLength: 1,
      maxLength: 255,
      example: "cedula-frontal.jpg",
    },
    content_type: {
      type: "string",
      enum: ["image/jpeg", "image/png", "image/webp"],
      example: "image/jpeg",
    },
  },
};

const seniorDocumentUploadUrlResponseSchema = {
  type: "object",
  required: ["bucket", "path", "signed_url", "token"],
  properties: {
    bucket: { type: "string", example: "cedulas" },
    path: {
      type: "string",
      example: "passengers/senior.passenger@example.com/1782511200000-cedula-frontal.jpg",
    },
    signed_url: { type: "string", format: "uri" },
    token: { type: "string", nullable: true },
  },
};

const loginRequestSchema = {
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: {
      type: "string",
      format: "email",
      maxLength: 150,
      example: "carlos.passenger@example.com",
    },
    password: { type: "string", minLength: 8, maxLength: 100, example: "Password123" },
  },
};

const oauthStartRequestSchema = {
  type: "object",
  required: ["provider"],
  additionalProperties: false,
  properties: {
    provider: { type: "string", enum: ["google", "apple", "github"] },
    redirect_to: { type: "string", format: "uri" },
  },
};

const passengerProfileSchema = {
  type: "object",
  required: ["user_id"],
  properties: {
    user_id: { type: "string", format: "uuid" },
    phone: { type: "string", nullable: true, example: "88888888" },
    notification_preferences: { type: "object", nullable: true, additionalProperties: true },
    is_senior: { type: "boolean", nullable: true, example: false },
    expo_push_token: { type: "string", nullable: true },
    birth_date: { type: "string", nullable: true, example: "1960-05-10" },
    senior_status: {
      type: "string",
      nullable: true,
      enum: ["not_applicable", "pending", "approved", "rejected", null],
      example: "pending",
    },
  },
};

const registerPassengerResponseSchema = {
  type: "object",
  required: ["user_id", "role", "passenger"],
  properties: {
    user_id: { type: "string", format: "uuid" },
    role: { type: "string", enum: [ROLES.PASSENGER] },
    passenger: { $ref: "#/components/schemas/PassengerProfile" },
  },
};

const loginResponseSchema = {
  type: "object",
  required: ["access_token", "refresh_token", "expires_in", "token_type", "user"],
  properties: {
    access_token: { type: "string" },
    refresh_token: { type: "string" },
    expires_in: { type: "integer", example: 3600 },
    token_type: { type: "string", example: "bearer" },
    user: {
      type: "object",
      required: ["id", "email"],
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string", format: "email" },
        role: { type: "string", nullable: true, example: ROLES.PASSENGER },
        name: { type: "string", nullable: true, example: "Carlos Marin" },
      },
    },
    capabilities: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const oauthStartResponseSchema = {
  type: "object",
  required: ["provider", "authorization_url"],
  properties: {
    provider: { type: "string", enum: ["google", "apple", "github"] },
    authorization_url: { type: "string", format: "uri" },
  },
};

const sessionResponseSchema = {
  type: "object",
  required: ["user_id", "role", "capabilities"],
  properties: {
    user_id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email", nullable: true },
    role: { type: "string", enum: Object.values(ROLES) },
    capabilities: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const passengerIncidentSchema = {
  type: "object",
  required: ["id", "trip_id", "type", "latitude", "longitude", "timestamp"],
  properties: {
    id: { type: "string", format: "uuid" },
    trip_id: { type: "string", format: "uuid" },
    type: { type: "string", minLength: 1, maxLength: 80, example: "traffic" },
    description: {
      type: "string",
      nullable: true,
      maxLength: 500,
      example: "Traffic jam near the main stop.",
    },
    latitude: { type: "number", minimum: -90, maximum: 90, example: 9.9763 },
    longitude: { type: "number", minimum: -180, maximum: 180, example: -84.8384 },
    timestamp: { type: "string", format: "date-time" },
  },
};

const createPassengerIncidentRequestSchema = {
  type: "object",
  required: ["trip_id", "type", "latitude", "longitude"],
  additionalProperties: false,
  properties: {
    trip_id: {
      type: "string",
      format: "uuid",
      example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    },
    type: { type: "string", minLength: 1, maxLength: 80, example: "traffic" },
    description: {
      type: "string",
      maxLength: 500,
      example: "Traffic jam near the main stop.",
    },
    latitude: { type: "number", minimum: -90, maximum: 90, example: 9.9763 },
    longitude: { type: "number", minimum: -180, maximum: 180, example: -84.8384 },
  },
};

const createPassengerIncidentResponseSchema = {
  type: "object",
  required: ["incident_id", "incident"],
  properties: {
    incident_id: { type: "string", format: "uuid" },
    incident: { $ref: "#/components/schemas/PassengerIncident" },
  },
};

const pushDeviceSchema = {
  type: "object",
  required: ["id", "user_id", "installation_id", "target_type", "platform", "is_active"],
  properties: {
    id: { type: "string", format: "uuid" },
    user_id: { type: "string", format: "uuid" },
    installation_id: { type: "string", format: "uuid" },
    target_type: { type: "string", enum: ["fid", "registration_token"] },
    platform: { type: "string", enum: ["android", "ios", "web"] },
    app_version: { type: "string", nullable: true },
    is_active: { type: "boolean" },
    last_seen_at: { type: "string", format: "date-time" },
  },
};

const upsertPushDeviceRequestSchema = {
  type: "object",
  required: ["target_type", "target_value", "platform"],
  additionalProperties: false,
  properties: {
    target_type: { type: "string", enum: ["fid", "registration_token"] },
    target_value: { type: "string", minLength: 20, maxLength: 4096 },
    platform: { type: "string", enum: ["android", "ios", "web"] },
    app_version: { type: "string", minLength: 1, maxLength: 50 },
  },
};

const notificationPreferencesSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: false,
  properties: {
    push_enabled: { type: "boolean" },
    terminal_departure: { type: "boolean" },
    delay: { type: "boolean" },
    detour: { type: "boolean" },
    cancellation: { type: "boolean" },
    route_restored: { type: "boolean" },
  },
};

const tripSubscriptionSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    passenger_id: { type: "string", format: "uuid" },
    trip_id: { type: "string", format: "uuid" },
    boarding_stop_id: { type: "string", format: "uuid", nullable: true },
    destination_stop_id: { type: "string", format: "uuid", nullable: true },
    alert_radius_meters: { type: "integer", minimum: 50, maximum: 5000 },
    status: { type: "string", enum: ["active", "exited"] },
  },
};

const notificationSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    user_id: { type: "string", format: "uuid" },
    trip_id: { type: "string", format: "uuid" },
    event_id: { type: "string", format: "uuid", nullable: true },
    notification_type: {
      type: "string",
      enum: ["terminal_departure", "delay", "detour", "cancellation", "route_restored"],
    },
    title: { type: "string" },
    message: { type: "string" },
    status: { type: "string", enum: ["Pending", "Sent", "Read", "Failed"] },
    data: { type: "object", additionalProperties: true },
    timestamp: { type: "string", format: "date-time" },
    sent_at: { type: "string", format: "date-time", nullable: true },
  },
};

const delayTripRequestSchema = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 500 },
    estimated_delay_minutes: { type: "integer", minimum: 1, maximum: 1440 },
  },
};

const cancelTripRequestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 500 },
  },
};

const detourRequestSchema = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 500 },
    geometry_geojson: { $ref: "#/components/schemas/RouteGeometry" },
    affected_stop_ids: {
      type: "array",
      maxItems: 50,
      items: { type: "string", format: "uuid" },
    },
    expected_end_at: { type: "string", format: "date-time" },
  },
};

const detourSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    trip_id: { type: "string", format: "uuid" },
    reported_by: { type: "string", format: "uuid", nullable: true },
    resolved_by: { type: "string", format: "uuid", nullable: true },
    reason: { type: "string" },
    details: { type: "object", additionalProperties: true },
    status: { type: "string", enum: ["active", "resolved"] },
    started_at: { type: "string", format: "date-time" },
    resolved_at: { type: "string", format: "date-time", nullable: true },
  },
};

const errorResponse = (description) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
  },
});

const idPathParam = {
  name: "id",
  in: "path",
  required: true,
  description: "Identificador UUID del recurso.",
  schema: { type: "string", format: "uuid" },
};

const bearerSecurity = [{ bearerAuth: [] }];

const unauthorizedResponse = errorResponse(
  "Falta Authorization Bearer o el token es invalido o expirado.",
);

const forbiddenResponse = errorResponse(
  "El rol autenticado no tiene permisos para esta operacion.",
);

const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Bus Tracking API - Rutas y Viajes",
    version: "1.0.0",
    description:
      "Documentacion de los endpoints de los modulos de Rutas y Viajes (CRUD administrativo " +
      "y consulta para consumidores). FR-06 / FR-15 / FR-16 / FR-23. " +
      "Los endpoints protegidos requieren Authorization: Bearer <jwt> validado contra Supabase Auth. " +
      "Los GET /{id} y las reactivaciones son endpoints aditivos, " +
      "fuera del CSV oficial. La integridad de route_id/bus_id/driver_id en Viajes la " +
      "garantiza la FK de la base de datos (violacion => 409 TRIP_REFERENCE_INVALID).",
  },
  servers: [{ url: "/", description: "Servidor actual" }],
  tags: [
    { name: "Health", description: "Estado del servicio." },
    {
      name: "Authentication",
      description: "Registro e inicio de sesion de usuarios.",
    },
    {
      name: "Pasajero - Incidentes",
      description: `Reporte y consulta de incidentes para rol ${ROLES.PASSENGER}.`,
    },
    {
      name: "Admin - Rutas",
      description: `CRUD de rutas (conceptualmente rol ${ROLES.ADMIN}).`,
    },
    {
      name: "Consumidor - Rutas",
      description: `Consulta de rutas activas (roles ${ROLES.PASSENGER}, ${ROLES.DRIVER}, ${ROLES.ADMIN}).`,
    },
    {
      name: "Admin - Drivers",
      description:
        `Driver CRUD endpoints. Conceptually restricted to role ${ROLES.ADMIN}. ` +
        "Authentication is temporarily disabled: endpoints are open.",
    },
    {
      name: "Admin - Viajes",
      description: `CRUD de viajes (conceptualmente rol ${ROLES.ADMIN}).`,
    },
    {
      name: "Conductor - Operacion",
      description: `Transiciones operativas y telemetria para rol ${ROLES.DRIVER}.`,
    },
    {
      name: "Pasajero - Notificaciones",
      description: `Dispositivos, suscripciones y bandeja de alertas para rol ${ROLES.PASSENGER}.`,
    },
    {
      name: "Admin - Paradas",
      description: `CRUD de paradas de ruta (conceptualmente rol ${ROLES.ADMIN}).`,
    },
    {
      name: "Admin - Incidentes",
      description: `Moderacion de incidentes reportados (conceptualmente rol ${ROLES.ADMIN}).`,
    },
    {
      name: "Admin - Telemetria",
      description: `Telemetria historica y en vivo para el panel administrativo (rol ${ROLES.ADMIN}).`,
    },

    {
      name: "Consumidor - Viajes",
      description:
        `Consulta de viajes visibles (roles ${ROLES.PASSENGER}, ${ROLES.DRIVER}, ${ROLES.ADMIN}). ` +
        "Excluye viajes Cancelled y Completed.",
    },
    {
      name: "Google Routes",
      description:
        "Google Routes API integration for route distance, duration and encoded polyline calculation.",
    },
    {
      name: "Tickets",
      description:
        "Passenger checkout and QR boarding pass generation endpoints.",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token JWT emitido por Supabase Auth.",
      },
    },
    schemas: {
      CheckoutTicketRequest: checkoutTicketRequestSchema,
      Ticket: ticketSchema,
      ErrorEnvelope: errorEnvelopeSchema,
      RouteGeometry: routeGeometrySchema,
      AdminRoute: adminRouteSchema,
      ConsumerRoute: consumerRouteSchema,
      CreateRouteRequest: createRouteRequestSchema,
      UpdateRouteRequest: updateRouteRequestSchema,
      TripStatus: tripStatusSchema,
      AdminTrip: adminTripSchema,
      ConsumerTrip: consumerTripSchema,
      CreateTripRequest: createTripRequestSchema,
      UpdateTripRequest: updateTripRequestSchema,
      UpdateTripStatusRequest: updateTripStatusRequestSchema,
      AdminStop: adminStopSchema,
      CreateStopRequest: createStopRequestSchema,
      UpdateStopRequest: updateStopRequestSchema,
      AdminIncident: adminIncidentSchema,
      ModerateIncidentRequest: moderateIncidentRequestSchema,
      TelemetryPoint: telemetryPointSchema,
      CurrentTelemetryPoint: currentTelemetryPointSchema,
      Driver: driverSchema,
      CreateDriverRequest: createDriverRequestSchema,
      UpdateDriverRequest: updateDriverRequestSchema,
      RegisterPassengerRequest: registerPassengerRequestSchema,
      RegisterPassengerResponse: registerPassengerResponseSchema,
      SeniorDocumentUploadUrlRequest: seniorDocumentUploadUrlRequestSchema,
      SeniorDocumentUploadUrlResponse: seniorDocumentUploadUrlResponseSchema,
      LoginRequest: loginRequestSchema,
      LoginResponse: loginResponseSchema,
      OAuthStartRequest: oauthStartRequestSchema,
      OAuthStartResponse: oauthStartResponseSchema,
      SessionResponse: sessionResponseSchema,
      PassengerProfile: passengerProfileSchema,
      PassengerIncident: passengerIncidentSchema,
      CreatePassengerIncidentRequest: createPassengerIncidentRequestSchema,
      CreatePassengerIncidentResponse: createPassengerIncidentResponseSchema,
      PushDevice: pushDeviceSchema,
      UpsertPushDeviceRequest: upsertPushDeviceRequestSchema,
      NotificationPreferences: notificationPreferencesSchema,
      TripSubscription: tripSubscriptionSchema,
      Notification: notificationSchema,
      DelayTripRequest: delayTripRequestSchema,
      CancelTripRequest: cancelTripRequestSchema,
      DetourRequest: detourRequestSchema,
      Detour: detourSchema,
      LatLngRequest: latLngRequestSchema,
      ComputeGoogleRouteRequest: computeGoogleRouteRequestSchema,
      ComputeGoogleRouteResponse: computeGoogleRouteResponseSchema,
      CreatedResponse: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
      UpdatedResponse: {
        type: "object",
        required: ["updated"],
        properties: { updated: { type: "boolean", enum: [true] } },
      },
      DeletedResponse: {
        type: "object",
        required: ["deleted"],
        properties: { deleted: { type: "boolean", enum: [true] } },
      },
      ReactivatedResponse: {
        type: "object",
        required: ["reactivated"],
        properties: { reactivated: { type: "boolean", enum: [true] } },
      },
      HealthResponse: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", example: "ok" } },
      },
      SeniorVerificationStatus: {
        type: "string",
        enum: ["pending", "approved", "rejected"],
        example: "pending",
      },

      SeniorVerificationRequest: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          },
          passenger_id: {
            type: "string",
            format: "uuid",
            example: "4f2504e0-4f89-41d3-9a0c-0305e82c3302",
          },
          document_image_bucket: {
            type: "string",
            example: "cedulas",
          },
          document_image_path: {
            type: "string",
            example: "passengers/senior.passenger@example.com/cedula.jpg",
          },
          status: {
            $ref: "#/components/schemas/SeniorVerificationStatus",
          },
          reviewed_by: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "5f2504e0-4f89-41d3-9a0c-0305e82c3303",
          },
          reviewed_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: "2026-06-20T11:00:00Z",
          },
          rejection_reason: {
            type: "string",
            nullable: true,
            example: "The uploaded document is not readable.",
          },
          created_at: {
            type: "string",
            format: "date-time",
            example: "2026-06-20T10:00:00Z",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            example: "2026-06-20T10:00:00Z",
          },
        },
      },

      SeniorVerificationRequestDetail: {
        allOf: [
          {
            $ref: "#/components/schemas/SeniorVerificationRequest",
          },
          {
            type: "object",
            properties: {
              user: {
                type: "object",
                nullable: true,
                properties: {
                  id: {
                    type: "string",
                    format: "uuid",
                    example: "4f2504e0-4f89-41d3-9a0c-0305e82c3302",
                  },
                  name: {
                    type: "string",
                    example: "Senior Passenger",
                  },
                  email: {
                    type: "string",
                    format: "email",
                    example: "senior.passenger@example.com",
                  },
                  is_active: {
                    type: "boolean",
                    example: false,
                  },
                  deactivated_at: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                  created_at: {
                    type: "string",
                    format: "date-time",
                  },
                },
              },
              passenger: {
                type: "object",
                nullable: true,
                properties: {
                  user_id: {
                    type: "string",
                    format: "uuid",
                    example: "4f2504e0-4f89-41d3-9a0c-0305e82c3302",
                  },
                  phone: {
                    type: "string",
                    nullable: true,
                    example: "88882222",
                  },
                  notification_preferences: {
                    type: "object",
                    nullable: true,
                  },
                  is_senior: {
                    type: "boolean",
                    example: false,
                  },
                  expo_push_token: {
                    type: "string",
                    nullable: true,
                  },
                  birth_date: {
                    type: "string",
                    format: "date",
                    nullable: true,
                    example: "1960-05-10",
                  },
                  senior_status: {
                    type: "string",
                    example: "not_applicable",
                  },
                },
              },
            },
          },
        ],
      },

      ApproveSeniorRequestBody: {
        type: "object",
        properties: {
          reviewed_by: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "5f2504e0-4f89-41d3-9a0c-0305e82c3303",
          },
        },
      },

      RejectSeniorRequestBody: {
        type: "object",
        required: ["rejection_reason"],
        properties: {
          reviewed_by: {
            type: "string",
            format: "uuid",
            nullable: true,
            example: "5f2504e0-4f89-41d3-9a0c-0305e82c3303",
          },
          rejection_reason: {
            type: "string",
            minLength: 1,
            maxLength: 500,
            example: "The uploaded document is not readable.",
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Estado del servicio",
        responses: {
          200: {
            description: "El servicio responde.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/senior-document/upload-url": {
      post: {
        tags: ["Authentication"],
        summary: "Genera URL firmada para documento de adulto mayor",
        description:
          "Permite que el cliente movil suba la imagen de identificacion al bucket cedulas antes del registro senior.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SeniorDocumentUploadUrlRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "URL firmada creada correctamente.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SeniorDocumentUploadUrlResponse" },
              },
            },
          },
          400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          500: errorResponse("No se pudo crear la URL firmada para subir el documento."),
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Registra un pasajero",
        description: "EP-01. Crea una cuenta de pasajero en Supabase Auth y su perfil local.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterPassengerRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Pasajero registrado correctamente.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterPassengerResponse" },
              },
            },
          },
          400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          409: errorResponse("Ya existe un usuario con ese email."),
          500: errorResponse("No se pudo crear la cuenta de autenticacion del pasajero."),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Inicia sesion con credenciales",
        description: "EP-02. Autentica un usuario por email y password y devuelve su rol efectivo.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Inicio de sesion exitoso.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          401: errorResponse("Email o password invalido."),
        },
      },
    },
    "/api/auth/admin/login": {
      post: {
        tags: ["Authentication"],
        summary: "Inicia sesion administrativa",
        description: "Autentica un usuario y restringe el acceso a cuentas pre-verificadas con rol Admin.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Inicio de sesion administrativo exitoso.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          401: errorResponse("Email o password invalido."),
          403: errorResponse("La cuenta autenticada no pertenece a un administrador pre-verificado."),
        },
      },
    },
    "/api/auth/driver/login": {
      post: {
        tags: ["Authentication"],
        summary: "Inicia sesion como conductor",
        description:
          "Autentica un usuario por email y password, y valida que tenga rol Driver.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Inicio de sesion de conductor exitoso.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          401: errorResponse("Email o password invalido."),
          403: errorResponse("El usuario autenticado no tiene rol Driver."),
        },
      },
    },
    "/api/auth/oauth/start": {
      post: {
        tags: ["Authentication"],
        summary: "Inicia el flujo OAuth",
        description: "Genera la URL de autorizacion para proveedores OAuth compatibles con el cliente movil.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OAuthStartRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "URL de autorizacion generada correctamente.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OAuthStartResponse" },
              },
            },
          },
          400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          500: errorResponse("No se pudo iniciar el flujo OAuth."),
        },
      },
    },
    "/api/auth/session": {
      get: {
        tags: ["Authentication"],
        summary: "Consulta la sesion actual",
        description: "Devuelve el rol efectivo y las capacidades del usuario autenticado para que el cliente movil restrinja navegacion y funciones.",
        security: bearerSecurity,
        responses: {
          200: {
            description: "Sesion autenticada y resuelta contra el rol persistido.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionResponse" },
              },
            },
          },
          401: unauthorizedResponse,
        },
      },
    },
    "/api/passenger/incidents": {
      post: {
        tags: ["Pasajero - Incidentes"],
        summary: "Reporta un incidente",
        description: "EP-18. Permite que un pasajero reporte un incidente asociado a un viaje.",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePassengerIncidentRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Incidente reportado correctamente.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatePassengerIncidentResponse" },
              },
            },
          },
          401: unauthorizedResponse,
          400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          500: errorResponse("Error interno al crear el incidente."),
        },
      },
      get: {
        tags: ["Pasajero - Incidentes"],
        summary: "Lista incidentes de un viaje",
        description: "EP-20. Devuelve los incidentes asociados a un viaje especifico.",
        security: bearerSecurity,
        parameters: [
          {
            name: "trip_id",
            in: "query",
            required: true,
            description: "Identificador UUID del viaje.",
            schema: { type: "string", format: "uuid" },
            example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          },
        ],
        responses: {
          200: {
            description: "Arreglo de incidentes del viaje.",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PassengerIncident" },
                },
              },
            },
          },
          401: unauthorizedResponse,
          400: errorResponse("trip_id faltante o invalido."),
          500: errorResponse("Error interno al consultar incidentes."),
        },
      },
    },
    "/api/admin/routes": {
      get: {
        tags: ["Admin - Rutas"],
        summary: "Lista completa de rutas (incluye inactivas)",
        description: "EP-04. Solo Administrador.",
        security: bearerSecurity,
        responses: {
          200: {
            description: "Arreglo de rutas en forma administrativa.",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AdminRoute" },
                },
              },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
        },
      },
      post: {
        tags: ["Admin - Rutas"],
        summary: "Crea una ruta",
        description: "EP-05. Operacion administrativa.",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateRouteRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Ruta creada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatedResponse" },
              },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          400: errorResponse("Body invalido (validacion zod / GeoJSON / clave desconocida)."),
        },
      },
    },
    "/api/admin/routes/{id}": {
      get: {
        tags: ["Admin - Rutas"],
        summary: "Obtiene una ruta por id (incluye inactivas)",
        description: "Endpoint aditivo (fuera del CSV oficial). Operacion administrativa.",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Ruta en forma administrativa.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminRoute" },
              },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          400: errorResponse("Id no es UUID."),
          404: errorResponse("La ruta no existe."),
        },
      },
      put: {
        tags: ["Admin - Rutas"],
        summary: "Edita una ruta",
        description: "EP-06. Operacion administrativa. Requiere al menos un campo.",
        security: bearerSecurity,
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateRouteRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Ruta actualizada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdatedResponse" },
              },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          400: errorResponse("Id no es UUID o body invalido."),
          404: errorResponse("La ruta no existe."),
        },
      },
      delete: {
        tags: ["Admin - Rutas"],
        summary: "Desactiva una ruta (soft-delete)",
        description: "EP-07. Operacion administrativa. Marca is_active=false.",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Ruta desactivada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletedResponse" },
              },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          400: errorResponse("Id no es UUID."),
          404: errorResponse("La ruta no existe."),
        },
      },
    },
    "/api/admin/routes/{id}/reactivate": {
      post: {
        tags: ["Admin - Rutas"],
        summary: "Reactiva una ruta (deshace el soft-delete)",
        description: "Endpoint aditivo (fuera del CSV oficial). Marca is_active=true.",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Ruta reactivada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReactivatedResponse" },
              },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          400: errorResponse("Id no es UUID."),
          404: errorResponse("La ruta no existe."),
        },
      },
    },
    "/api/admin/drivers": {
      get: {
        tags: ["Admin - Drivers"],
        summary: "List drivers",
        description: "Returns all driver profiles, including active and inactive drivers.",
        responses: {
          200: {
            description: "Driver list returned successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Driver" },
                },
              },
            },
          },
          500: errorResponse("Internal server error."),
        },
      },
      post: {
        tags: ["Admin - Drivers"],
        summary: "Create driver",
        description: "Creates a driver authentication account and local driver profile.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDriverRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Driver created successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Driver" },
              },
            },
          },
          400: errorResponse("Invalid driver payload."),
          409: errorResponse("A user with this email already exists."),
          500: errorResponse("Internal server error."),
        },
      },
    },
    "/api/admin/drivers/{id}": {
      get: {
        tags: ["Admin - Drivers"],
        summary: "Get driver by id",
        description: "Returns one driver profile by user id.",
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Driver returned successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Driver" },
              },
            },
          },
          400: errorResponse("Id is not a valid UUID."),
          404: errorResponse("The requested driver does not exist."),
          500: errorResponse("Internal server error."),
        },
      },
      put: {
        tags: ["Admin - Drivers"],
        summary: "Update driver",
        description:
          "Updates driver authentication data, local user profile and driver profile.",
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateDriverRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Driver updated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Driver" },
              },
            },
          },
          400: errorResponse("Id is not a valid UUID or body is invalid."),
          404: errorResponse("The requested driver does not exist."),
          409: errorResponse("A user with this email already exists."),
          500: errorResponse("Internal server error."),
        },
      },
      delete: {
        tags: ["Admin - Drivers"],
        summary: "Deactivate driver",
        description:
          "Soft-deletes a driver by setting users.isActive to false. The record is not physically deleted.",
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Driver deactivated successfully.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Driver" },
              },
            },
          },
          400: errorResponse("Id is not a valid UUID."),
          404: errorResponse("The requested driver does not exist."),
          500: errorResponse("Internal server error."),
        },
      },
    },
    "/api/admin/senior-requests": {
    get: {
      tags: ["Admin - Senior Requests"],
      summary: "List senior citizen verification requests",
      description:
        "Returns senior citizen verification requests. Administrators can filter by status.",
      parameters: [
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            $ref: "#/components/schemas/SeniorVerificationStatus",
          },
          example: "pending",
        },
      ],
      responses: {
        200: {
          description: "Senior verification requests returned successfully.",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/SeniorVerificationRequestDetail",
                },
              },
            },
          },
        },
        400: {
          description: "Invalid query parameters.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorEnvelope",
              },
              example: {
                error: {
                  code: ERROR_CODES.SENIOR_VERIFICATION_VALIDATION_FAILED,
                  message: "Validacion fallida en query.",
                  details: [
                    {
                      path: "status",
                      message: "Invalid enum value.",
                      code: "invalid_enum_value",
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },

    "/api/admin/senior-requests/{id}": {
      get: {
        tags: ["Admin - Senior Requests"],
        summary: "Get a senior citizen verification request",
        description:
          "Returns the detail of a senior citizen verification request by id.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          },
        ],
        responses: {
          200: {
            description: "Senior verification request returned successfully.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SeniorVerificationRequestDetail",
                },
              },
            },
          },
          400: {
            description: "Invalid request id.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          404: {
            description: "Senior verification request not found.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
                example: {
                  error: {
                    code: ERROR_CODES.SENIOR_VERIFICATION_NOT_FOUND,
                    message:
                      "The requested senior verification request does not exist.",
                    details: null,
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/admin/senior-requests/{id}/approve": {
      patch: {
        tags: ["Admin - Senior Requests"],
        summary: "Approve a senior citizen verification request",
        description:
          "Approves a pending senior citizen verification request, activates the user account, and marks the passenger as an authorized senior citizen.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApproveSeniorRequestBody",
              },
              example: {},
            },
          },
        },
        responses: {
          200: {
            description: "Senior verification request approved successfully.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SeniorVerificationRequestDetail",
                },
                example: {
                  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
                  passenger_id: "4f2504e0-4f89-41d3-9a0c-0305e82c3302",
                  document_image_bucket: "cedulas",
                  document_image_path:
                    "passengers/senior.passenger@example.com/cedula.jpg",
                  status: "approved",
                  reviewed_by: null,
                  reviewed_at: "2026-06-20T11:00:00Z",
                  rejection_reason: null,
                  created_at: "2026-06-20T10:00:00Z",
                  updated_at: "2026-06-20T11:00:00Z",
                },
              },
            },
          },
          400: {
            description: "Invalid request payload.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          404: {
            description: "Senior verification request not found.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          409: {
            description: "The request was already reviewed.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
                example: {
                  error: {
                    code: ERROR_CODES.SENIOR_VERIFICATION_ALREADY_REVIEWED,
                    message:
                      "This senior verification request has already been reviewed.",
                    details: null,
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/admin/senior-requests/{id}/reject": {
      patch: {
        tags: ["Admin - Senior Requests"],
        summary: "Reject a senior citizen verification request",
        description:
          "Rejects a pending senior citizen verification request, keeps the user inactive, and stores a rejection reason.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            example: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RejectSeniorRequestBody",
              },
              example: {
                rejection_reason: "The uploaded document is not readable.",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Senior verification request rejected successfully.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SeniorVerificationRequestDetail",
                },
                example: {
                  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
                  passenger_id: "4f2504e0-4f89-41d3-9a0c-0305e82c3302",
                  document_image_bucket: "cedulas",
                  document_image_path:
                    "passengers/senior.passenger@example.com/cedula.jpg",
                  status: "rejected",
                  reviewed_by: null,
                  reviewed_at: "2026-06-20T11:00:00Z",
                  rejection_reason: "The uploaded document is not readable.",
                  created_at: "2026-06-20T10:00:00Z",
                  updated_at: "2026-06-20T11:00:00Z",
                },
              },
            },
          },
          400: {
            description: "Invalid request payload.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          404: {
            description: "Senior verification request not found.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
              },
            },
          },
          409: {
            description: "The request was already reviewed.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorEnvelope",
                },
                example: {
                  error: {
                    code: ERROR_CODES.SENIOR_VERIFICATION_ALREADY_REVIEWED,
                    message:
                      "This senior verification request has already been reviewed.",
                    details: null,
                  },
                },
              },
            },
          },
          401: unauthorizedResponse,
        },
      },
    },
    "/api/driver/trips": {
      get: {
        tags: ["Conductor - Operacion"],
        summary: "Lista los viajes asignados al conductor",
        security: bearerSecurity,
        responses: {
          200: {
            description: "Viajes asignados pendientes o activos.",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AdminTrip" } },
              },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
        },
      },
    },
    "/api/driver/trips/active": {
      get: {
        tags: ["Conductor - Operacion"],
        summary: "Obtiene el viaje activo del conductor",
        security: bearerSecurity,
        responses: {
          200: {
            description: "Viaje activo o null.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AdminTrip" } },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
        },
      },
    },
    "/api/driver/trips/{id}/start": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Inicia el viaje y genera la alerta de salida de terminal",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Viaje iniciado.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AdminTrip" } },
            },
          },
          400: errorResponse("Id invalido."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
          409: errorResponse("El estado actual no permite iniciar el viaje."),
        },
      },
    },
    "/api/driver/trips/{id}/complete": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Completa un viaje activo",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Viaje completado.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AdminTrip" } },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
          409: errorResponse("El viaje no esta activo."),
        },
      },
    },
    "/api/driver/trips/{id}/cancel": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Cancela un viaje y genera una alerta",
        security: bearerSecurity,
        parameters: [idPathParam],
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CancelTripRequest" } },
          },
        },
        responses: {
          200: {
            description: "Viaje cancelado.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AdminTrip" } },
            },
          },
          400: errorResponse("Body invalido."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
          409: errorResponse("El viaje ya finalizo."),
        },
      },
    },
    "/api/driver/trips/{id}/delay": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Reporta un retraso inesperado y genera una alerta",
        security: bearerSecurity,
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/DelayTripRequest" } },
          },
        },
        responses: {
          200: {
            description: "Retraso registrado.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AdminTrip" } },
            },
          },
          400: errorResponse("Body invalido."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
          409: errorResponse("El estado actual no admite un retraso."),
        },
      },
    },
    "/api/driver/trips/{id}/resume": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Reanuda un viaje retrasado o detenido",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Viaje reanudado.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AdminTrip" } },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
          409: errorResponse("El estado actual no admite reanudacion."),
        },
      },
    },
    "/api/driver/trips/{id}/detour": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Reporta un desvio temporal y genera una alerta",
        security: bearerSecurity,
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/DetourRequest" } },
          },
        },
        responses: {
          201: {
            description: "Desvio registrado.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Detour" } },
            },
          },
          400: errorResponse("Body invalido."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
          409: errorResponse("Ya existe un desvio activo o el viaje no esta activo."),
        },
      },
    },
    "/api/driver/trips/{id}/detour/resolve": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Resuelve el desvio activo y notifica la restauracion",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Desvio resuelto.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Detour" } },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("No existe un desvio activo para el viaje."),
        },
      },
    },
    "/api/driver/trips/{id}/location": {
      post: {
        tags: ["Conductor - Operacion"],
        summary: "Registra telemetria de un viaje activo",
        security: bearerSecurity,
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["latitude", "longitude"],
                additionalProperties: false,
                properties: {
                  latitude: { type: "number", minimum: -90, maximum: 90 },
                  longitude: { type: "number", minimum: -180, maximum: 180 },
                  speed: { type: "number", minimum: 0 },
                  heading: { type: "number", minimum: 0, maximum: 360 },
                  recorded_at: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Ubicacion registrada." },
          400: errorResponse("Body invalido."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
          409: errorResponse("El viaje no esta activo."),
        },
      },
    },
    "/api/passenger/push-devices/{installationId}": {
      put: {
        tags: ["Pasajero - Notificaciones"],
        summary: "Registra o actualiza un destino FCM",
        security: bearerSecurity,
        parameters: [{
          name: "installationId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpsertPushDeviceRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Dispositivo registrado sin exponer el destino FCM.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/PushDevice" } },
            },
          },
          400: errorResponse("Destino o plataforma invalida."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
        },
      },
      delete: {
        tags: ["Pasajero - Notificaciones"],
        summary: "Desactiva un destino FCM",
        security: bearerSecurity,
        parameters: [{
          name: "installationId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        }],
        responses: {
          204: { description: "Dispositivo desactivado." },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El dispositivo no existe."),
        },
      },
    },
    "/api/passenger/notification-preferences": {
      patch: {
        tags: ["Pasajero - Notificaciones"],
        summary: "Actualiza preferencias de alertas push",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/NotificationPreferences" } },
          },
        },
        responses: {
          200: { description: "Preferencias actualizadas." },
          400: errorResponse("Debe enviar al menos una preferencia valida."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El perfil de pasajero no existe."),
        },
      },
    },
    "/api/passenger/trips/{id}/subscription": {
      post: {
        tags: ["Pasajero - Notificaciones"],
        summary: "Sigue un viaje para recibir sus alertas",
        security: bearerSecurity,
        parameters: [idPathParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  boarding_stop_id: { type: "string", format: "uuid" },
                  destination_stop_id: { type: "string", format: "uuid" },
                  alert_radius_meters: { type: "integer", minimum: 50, maximum: 5000 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Suscripcion activa.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/TripSubscription" } },
            },
          },
          400: errorResponse("Viaje finalizado o paradas incompatibles con la ruta."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("El viaje no existe."),
        },
      },
      delete: {
        tags: ["Pasajero - Notificaciones"],
        summary: "Deja de seguir un viaje",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          204: { description: "Suscripcion finalizada." },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("La suscripcion no existe."),
        },
      },
    },
    "/api/passenger/notifications": {
      get: {
        tags: ["Pasajero - Notificaciones"],
        summary: "Lista la bandeja de notificaciones del pasajero",
        security: bearerSecurity,
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "unread_only", in: "query", schema: { type: "boolean", default: false } },
        ],
        responses: {
          200: {
            description: "Notificaciones del usuario autenticado.",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Notification" } },
              },
            },
          },
          400: errorResponse("Paginacion invalida."),
          401: unauthorizedResponse,
          403: forbiddenResponse,
        },
      },
    },
    "/api/passenger/notifications/{id}/read": {
      patch: {
        tags: ["Pasajero - Notificaciones"],
        summary: "Marca una notificacion propia como leida",
        security: bearerSecurity,
        parameters: [idPathParam],
        responses: {
          200: {
            description: "Notificacion marcada como leida.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Notification" } },
            },
          },
          401: unauthorizedResponse,
          403: forbiddenResponse,
          404: errorResponse("La notificacion no existe."),
        },
      },
    },
      "/api/passenger/routes": {
        get: {
          tags: ["Consumidor - Rutas"],
          summary: "Lista de rutas activas",
          description: "EP-14. Devuelve solo rutas activas.",
          security: bearerSecurity,
          responses: {
            200: {
              description: "Arreglo de rutas en forma de consumidor.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ConsumerRoute" },
                  },
                },
              },
            },
            401: unauthorizedResponse,
          },
        },
      },
      "/api/admin/trips": {
        get: {
          tags: ["Admin - Viajes"],
          summary: "Lista completa de viajes (todos los estados)",
          description: "Operacion administrativa.",
          security: bearerSecurity,
          responses: {
            200: {
              description: "Arreglo de viajes en forma administrativa.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/AdminTrip" },
                  },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
          },
        },
        post: {
          tags: ["Admin - Viajes"],
          summary: "Crea un viaje",
          description:
            "Operacion administrativa. route_id, bus_id y driver_id deben existir; " +
            "si no, la FK de la base de datos responde 409.",
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTripRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Viaje creado.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreatedResponse" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
            409: errorResponse(
              "route_id, bus_id o driver_id no corresponde a un registro existente.",
            ),
          },
        },
      },
      "/api/admin/trips/{id}": {
        get: {
          tags: ["Admin - Viajes"],
          summary: "Obtiene un viaje por id",
          description: "Endpoint aditivo (fuera del CSV oficial). Operacion administrativa.",
          security: bearerSecurity,
          parameters: [idPathParam],
          responses: {
            200: {
              description: "Viaje en forma administrativa.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminTrip" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID."),
            404: errorResponse("El viaje no existe."),
          },
        },
        put: {
          tags: ["Admin - Viajes"],
          summary: "Edita un viaje",
          description: "Operacion administrativa. Requiere al menos un campo.",
          security: bearerSecurity,
          parameters: [idPathParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateTripRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Viaje actualizado.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UpdatedResponse" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID o body invalido."),
            404: errorResponse("El viaje no existe."),
            409: errorResponse(
              "route_id, bus_id o driver_id no corresponde a un registro existente.",
            ),
          },
        },
        delete: {
          tags: ["Admin - Viajes"],
          summary: "Cancela un viaje (soft-delete)",
          description: "Operacion administrativa. Marca status=Cancelled.",
          security: bearerSecurity,
          parameters: [idPathParam],
          responses: {
            200: {
              description: "Viaje cancelado.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DeletedResponse" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID."),
            404: errorResponse("El viaje no existe."),
          },
        },
      },
      "/api/admin/trips/{id}/reactivate": {
        post: {
          tags: ["Admin - Viajes"],
          summary: "Reactiva un viaje (deshace el soft-delete)",
          description: "Endpoint aditivo (fuera del CSV oficial). Marca status=Scheduled.",
          security: bearerSecurity,
          parameters: [idPathParam],
          responses: {
            200: {
              description: "Viaje reactivado.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReactivatedResponse" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID."),
            404: errorResponse("El viaje no existe."),
          },
        },
      },
      "/api/admin/trips/{id}/status": {
        patch: {
          tags: ["Admin - Viajes"],
          summary: "Transiciona el estado de un viaje",
          description:
            "Endpoint aditivo (fuera del CSV oficial). Cambia status y, si es terminal " +
            "(Completed/Cancelled), registra ended_at y detiene el tracking en tiempo real.",
          security: bearerSecurity,
          parameters: [idPathParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateTripStatusRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Viaje con el nuevo estado.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminTrip" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID o status invalido."),
            404: errorResponse("El viaje no existe."),
          },
        },
      },
      "/api/admin/stops": {
        get: {
          tags: ["Admin - Paradas"],
          summary: "Lista de paradas de una ruta",
          description:
            "Endpoint aditivo (fuera del CSV oficial). Filtra por route_id opcional.",
          security: bearerSecurity,
          parameters: [
            {
              name: "route_id",
              in: "query",
              required: false,
              description: "Identificador UUID de la ruta.",
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            200: {
              description: "Arreglo de paradas.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/AdminStop" },
                  },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("route_id no es UUID."),
          },
        },
        post: {
          tags: ["Admin - Paradas"],
          summary: "Crea una parada",
          description: "Endpoint aditivo (fuera del CSV oficial).",
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateStopRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Parada creada.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreatedResponse" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Body invalido (validacion zod / clave desconocida)."),
          },
        },
      },
      "/api/admin/stops/{id}": {
        put: {
          tags: ["Admin - Paradas"],
          summary: "Edita una parada",
          description: "Endpoint aditivo (fuera del CSV oficial). Requiere al menos un campo.",
          security: bearerSecurity,
          parameters: [idPathParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateStopRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Parada actualizada.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminStop" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID o body invalido."),
            404: errorResponse("La parada no existe."),
          },
        },
        delete: {
          tags: ["Admin - Paradas"],
          summary: "Elimina una parada",
          description: "Endpoint aditivo (fuera del CSV oficial).",
          security: bearerSecurity,
          parameters: [idPathParam],
          responses: {
            200: {
              description: "Parada eliminada.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DeletedResponse" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID."),
            404: errorResponse("La parada no existe."),
          },
        },
      },
      "/api/admin/incidents": {
        get: {
          tags: ["Admin - Incidentes"],
          summary: "Lista incidentes reportados (con moderacion)",
          description:
            "Endpoint aditivo (fuera del CSV oficial). Filtra por status " +
            "con mayuscula inicial (Pending, Validated, Archived, Dismissed).",
          security: bearerSecurity,
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string", enum: ADMIN_REPORT_MODERATION_STATUS_VALUES },
            },
          ],
          responses: {
            200: {
              description: "Arreglo de incidentes en forma administrativa.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/AdminIncident" },
                  },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("status invalido."),
          },
        },
      },
      "/api/admin/incidents/{id}": {
        put: {
          tags: ["Admin - Incidentes"],
          summary: "Modera un incidente (estado de moderacion)",
          description:
            "Endpoint aditivo (fuera del CSV oficial). Valida, archiva o descarta un incidente.",
          security: bearerSecurity,
          parameters: [idPathParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModerateIncidentRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Incidente moderado.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminIncident" },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("Id no es UUID o status invalido."),
            404: errorResponse("El incidente no existe."),
          },
        },
      },
      "/api/admin/telemetry/history": {
        get: {
          tags: ["Admin - Telemetria"],
          summary: "Historial de telemetria de un viaje",
          description:
            "Endpoint aditivo (fuera del CSV oficial). Opcionalmente acotado por rango de tiempo.",
          security: bearerSecurity,
          parameters: [
            {
              name: "trip_id",
              in: "query",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "start_time",
              in: "query",
              required: false,
              schema: { type: "string", format: "date-time" },
            },
            {
              name: "end_time",
              in: "query",
              required: false,
              schema: { type: "string", format: "date-time" },
            },
          ],
          responses: {
            200: {
              description: "Arreglo de puntos de telemetria ordenados ascendentemente.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TelemetryPoint" },
                  },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
            400: errorResponse("trip_id o rango de tiempo invalido."),
          },
        },
      },
      "/api/admin/telemetry/current": {
        get: {
          tags: ["Admin - Telemetria"],
          summary: "Ubicacion en vivo de los viajes activos",
          description:
            "Endpoint aditivo (fuera del CSV oficial). Devuelve la ultima telemetria " +
            "de cada viaje In Progress para dibujar los buses en el mapa.",
          security: bearerSecurity,
          responses: {
            200: {
              description: "Arreglo de puntos actuales por viaje activo.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CurrentTelemetryPoint" },
                  },
                },
              },
            },
            401: unauthorizedResponse,
            403: forbiddenResponse,
          },
        },
      },
      "/api/passenger/trips": {
        get: {
          tags: ["Consumidor - Viajes"],
          summary: "Lista de viajes visibles",
          description: "Devuelve viajes que no esten Cancelled ni Completed.",
          security: bearerSecurity,
          responses: {
            200: {
              description: "Arreglo de viajes en forma de consumidor.",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ConsumerTrip" },
                  },
                },
              },
            },
            401: unauthorizedResponse,
          },
        },
      },
            "/api/google/routes/compute": {
        post: {
          tags: ["Google Routes"],
          summary: "Compute route with Google Routes API",
          description:
            "Calculates driving distance, duration and encoded polyline between two coordinates using Google Routes API.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ComputeGoogleRouteRequest",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Route calculated successfully.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ComputeGoogleRouteResponse",
                  },
                },
              },
            },
            400: errorResponse("Invalid coordinates payload."),
            404: errorResponse("Google Routes API did not return a route."),
            500: errorResponse("Google Routes API request failed or internal server error."),
          },
        },
      },

      "/api/tickets/checkout": {
        post: {
          tags: ["Tickets"],
          summary: "Create ticket checkout",
          description:
            "Simulates a checkout flow with approximately 1.5 seconds of latency, creates a generated ticket, and returns a secure QR payload for boarding pass rendering.",
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CheckoutTicketRequest",
                },
                example: {
                  trip_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
                },
              },
            },
          },
          responses: {
            201: {
              description: "Ticket generated successfully.",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Ticket",
                  },
                },
              },
            },
            400: errorResponse("Invalid checkout payload."),
            401: errorResponse("Authentication is required."),
            500: errorResponse("Ticket checkout failed."),
          },
        },
      },
    },
  };

module.exports = { openapiDocument };
