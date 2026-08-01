"use strict";

const express = require("express");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const asyncHandler = require("../../../utils/asyncHandler");
const {
  createPassengerIncidentSchema,
  listPassengerIncidentsQuerySchema,
} = require("../../../models/incident.model");
const passengerIncidentsRepository = require("../../../repositories/incidentsRepository");
const SupabasePassengerIncidentRepository = require("./infrastructure/SupabasePassengerIncidentRepository");
const { incidentWindowStart } = require("../../../constants/incidentWindow");

class PassengerIncidentRepository {
  async createPassengerIncident(_payload) {
    throw new Error("PassengerIncidentRepository.createPassengerIncident must be implemented.");
  }

  async findIncidentsByTripId(_tripId) {
    throw new Error("PassengerIncidentRepository.findIncidentsByTripId must be implemented.");
  }
}

class PassengerIncidentService {
  constructor(passengerIncidentRepository) {
    this.passengerIncidentRepository = passengerIncidentRepository;
  }

  async createPassengerIncident(payload) {
    return this.passengerIncidentRepository.createPassengerIncident({
      trip_id: payload.trip_id,
      type: payload.type,
      description: payload.description || null,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });
  }

  async listPassengerIncidents(query) {
    return this.passengerIncidentRepository.findIncidentsByTripId(query.trip_id, {
      since: incidentWindowStart(),
    });
  }
}

class PassengerIncidentController {
  constructor(passengerIncidentService) {
    this.passengerIncidentService = passengerIncidentService;
    this.createPassengerIncident = asyncHandler(this.createPassengerIncident.bind(this));
    this.listPassengerIncidents = asyncHandler(this.listPassengerIncidents.bind(this));
  }

  async createPassengerIncident(req, res) {
    const row = await this.passengerIncidentService.createPassengerIncident(req.valid.body);
    res.status(HTTP_STATUS.CREATED).json({
      incident_id: row.id,
      incident: row,
    });
  }

  async listPassengerIncidents(req, res) {
    const rows = await this.passengerIncidentService.listPassengerIncidents(req.valid.query);
    res.status(HTTP_STATUS.OK).json(rows);
  }
}

function createPassengerIncidentsModule(dependencies = {}) {
  const passengerIncidentRepository =
    dependencies.passengerIncidentRepository ||
    (dependencies.useConcreteRepository
      ? new SupabasePassengerIncidentRepository()
      : passengerIncidentsRepository);
  const passengerIncidentService =
    dependencies.passengerIncidentService ||
    new PassengerIncidentService(passengerIncidentRepository);
  const passengerIncidentController =
    dependencies.passengerIncidentController ||
    new PassengerIncidentController(passengerIncidentService);

  return {
    passengerIncidentRepository,
    passengerIncidentService,
    passengerIncidentController,
  };
}

function createPassengerIncidentsRouter(dependencies = {}) {
  const { passengerIncidentController } = createPassengerIncidentsModule(dependencies);
  const router = express.Router();

  router.use(requireAuth);
  router.post(
    "/",
    validate({ body: createPassengerIncidentSchema }, ERROR_CODES.INCIDENT_VALIDATION_FAILED),
    passengerIncidentController.createPassengerIncident,
  );
  router.get(
    "/",
    validate({ query: listPassengerIncidentsQuerySchema }, ERROR_CODES.INCIDENT_VALIDATION_FAILED),
    passengerIncidentController.listPassengerIncidents,
  );

  return router;
}

module.exports = {
  PassengerIncidentRepository,
  SupabasePassengerIncidentRepository,
  PassengerIncidentService,
  PassengerIncidentController,
  createPassengerIncidentsModule,
  createPassengerIncidentsRouter,
};