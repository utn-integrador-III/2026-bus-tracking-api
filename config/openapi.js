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

const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Bus Tracking API - Rutas y Viajes",
    version: "1.0.0",
    description:
      "Documentacion de los endpoints de los modulos de Rutas y Viajes (CRUD administrativo " +
      "y consulta para consumidores). FR-06 / FR-15 / FR-16 / FR-23. " +
      "NOTA: la autenticacion (JWT + RBAC) esta temporalmente DESACTIVADA; los endpoints " +
      "estan abiertos hasta que exista el modulo de usuarios, momento en que se reactivara " +
      "el middleware. Los GET /{id} y las reactivaciones son endpoints aditivos, " +
      "fuera del CSV oficial. La integridad de route_id/bus_id/driver_id en Viajes la " +
      "garantiza la FK de la base de datos (violacion => 409 TRIP_REFERENCE_INVALID).",
  },
  servers: [{ url: "/", description: "Servidor actual" }],
  tags: [
    { name: "Health", description: "Estado del servicio." },
    {
      name: "Admin - Rutas",
      description:
        `CRUD de rutas (conceptualmente rol ${ROLES.ADMIN}). ` +
        "Auth temporalmente desactivada: endpoints abiertos.",
    },
    {
      name: "Consumidor - Rutas",
      description:
        `Consulta de rutas activas (roles ${ROLES.PASSENGER}, ${ROLES.DRIVER}, ${ROLES.ADMIN}). ` +
        "Auth temporalmente desactivada: endpoint abierto.",
    },
    {
      name: "Admin - Viajes",
      description:
        `CRUD de viajes (conceptualmente rol ${ROLES.ADMIN}). ` +
        "Auth temporalmente desactivada: endpoints abiertos.",
    },
    {
      name: "Consumidor - Viajes",
      description:
        `Consulta de viajes visibles (roles ${ROLES.PASSENGER}, ${ROLES.DRIVER}, ${ROLES.ADMIN}). ` +
        "Excluye viajes Cancelled y Completed. Auth temporalmente desactivada: endpoint abierto.",
    },
  ],
  components: {
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
    "/api/admin/routes": {
      get: {
        tags: ["Admin - Rutas"],
        summary: "Lista completa de rutas (incluye inactivas)",
        description: "EP-04. Solo Administrador.",
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
        },
      },
      post: {
        tags: ["Admin - Rutas"],
        summary: "Crea una ruta",
        description: "EP-05. Operacion administrativa.",
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
          400: errorResponse("Body invalido (validacion zod / GeoJSON / clave desconocida)."),
        },
      },
    },
    "/api/admin/routes/{id}": {
      get: {
        tags: ["Admin - Rutas"],
        summary: "Obtiene una ruta por id (incluye inactivas)",
        description: "Endpoint aditivo (fuera del CSV oficial). Operacion administrativa.",
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
          400: errorResponse("Id no es UUID."),
          404: errorResponse("La ruta no existe."),
        },
      },
      put: {
        tags: ["Admin - Rutas"],
        summary: "Edita una ruta",
        description: "EP-06. Operacion administrativa. Requiere al menos un campo.",
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
          400: errorResponse("Id no es UUID o body invalido."),
          404: errorResponse("La ruta no existe."),
        },
      },
      delete: {
        tags: ["Admin - Rutas"],
        summary: "Desactiva una ruta (soft-delete)",
        description: "EP-07. Operacion administrativa. Marca is_active=false.",
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
        },
      },
    },
    "/api/admin/trips": {
      get: {
        tags: ["Admin - Viajes"],
        summary: "Lista completa de viajes (todos los estados)",
        description: "Operacion administrativa.",
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
        },
      },
      post: {
        tags: ["Admin - Viajes"],
        summary: "Crea un viaje",
        description:
          "Operacion administrativa. route_id, bus_id y driver_id deben existir; " +
          "si no, la FK de la base de datos responde 409.",
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
          400: errorResponse("Id no es UUID."),
          404: errorResponse("El viaje no existe."),
        },
      },
      put: {
        tags: ["Admin - Viajes"],
        summary: "Edita un viaje",
        description: "Operacion administrativa. Requiere al menos un campo.",
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
        },
      },
    },
  },
};

module.exports = { openapiDocument };
