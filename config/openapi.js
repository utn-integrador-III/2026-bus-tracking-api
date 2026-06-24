"use strict";

const { ROLES } = require("../constants/roles");
const { ERROR_CODES } = require("../constants/errorCodes");
const { TRIP_STATUS_VALUES } = require("../constants/tripStatus");

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
    created_at: { type: "string", format: "date-time", nullable: true },
    started_at: { type: "string", format: "date-time", nullable: true },
    ended_at: { type: "string", format: "date-time", nullable: true },
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
  },
  example: { status: "Delayed" },
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
      name: "Admin - Viajes",
      description: `CRUD de viajes (conceptualmente rol ${ROLES.ADMIN}).`,
    },
    {
      name: "Consumidor - Viajes",
      description:
        `Consulta de viajes visibles (roles ${ROLES.PASSENGER}, ${ROLES.DRIVER}, ${ROLES.ADMIN}). ` +
        "Excluye viajes Cancelled y Completed.",
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
      RegisterPassengerRequest: registerPassengerRequestSchema,
      RegisterPassengerResponse: registerPassengerResponseSchema,
      LoginRequest: loginRequestSchema,
      LoginResponse: loginResponseSchema,
      OAuthStartRequest: oauthStartRequestSchema,
      OAuthStartResponse: oauthStartResponseSchema,
      SessionResponse: sessionResponseSchema,
      PassengerProfile: passengerProfileSchema,
      PassengerIncident: passengerIncidentSchema,
      CreatePassengerIncidentRequest: createPassengerIncidentRequestSchema,
      CreatePassengerIncidentResponse: createPassengerIncidentResponseSchema,
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
  },
};

module.exports = { openapiDocument };
