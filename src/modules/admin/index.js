"use strict";

const express = require("express");
const { ROLES } = require("../../../constants/roles");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const requireRole = require("../../../middleware/requireRole");
const {
  idParamSchema,
  listStopsQuerySchema,
  stopSchema,
  listIncidentsQuerySchema,
  moderateIncidentSchema,
  telemetryHistoryQuerySchema,
  listUsersQuerySchema,
} = require("../../../models/admin.model");
const SupabaseAdminRepository = require("./infrastructure/SupabaseAdminRepository");

class AdminRepository {
  async listBuses() {
    throw new Error("AdminRepository.listBuses must be implemented.");
  }

  async listStops(_routeId) {
    throw new Error("AdminRepository.listStops must be implemented.");
  }

  async createStop(_payload) {
    throw new Error("AdminRepository.createStop must be implemented.");
  }

  async deleteStop(_id) {
    throw new Error("AdminRepository.deleteStop must be implemented.");
  }

  async listIncidents(_status) {
    throw new Error("AdminRepository.listIncidents must be implemented.");
  }

  async getIncidentById(_id) {
    throw new Error("AdminRepository.getIncidentById must be implemented.");
  }

  async setIncidentModeration(_id, _moderationStatus, _moderatedBy) {
    throw new Error("AdminRepository.setIncidentModeration must be implemented.");
  }

  async getTelemetryHistory(_tripId, _startTime, _endTime) {
    throw new Error("AdminRepository.getTelemetryHistory must be implemented.");
  }

  async listUsers(_role) {
    throw new Error("AdminRepository.listUsers must be implemented.");
  }
}

class AdminPresenter {
  presentBus(row) {
    return {
      id: row.id,
      plate_number: row.plate_number,
      capacity: row.capacity,
      status: row.status,
      created_at: row.created_at,
    };
  }

  presentBuses(rows) {
    return rows.map((row) => this.presentBus(row));
  }

  presentStop(row) {
    return {
      id: row.id,
      route_id: row.route_id,
      name: row.name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      stop_order: row.stop_order,
      geofence_radius_meters: row.geofence_radius_meters,
    };
  }

  presentStops(rows) {
    return rows.map((row) => this.presentStop(row));
  }

  presentIncident(row) {
    return {
      id: row.id,
      trip_id: row.trip_id,
      user_id: row.user_id,
      type: row.type,
      description: row.description,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      timestamp: row.timestamp,
      moderation_status: row.moderation_status,
    };
  }

  presentIncidents(rows) {
    return rows.map((row) => this.presentIncident(row));
  }

  presentTelemetryPoint(row) {
    return {
      id: row.id,
      trip_id: row.trip_id,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speed: row.speed,
      heading: row.heading,
      recorded_at: row.recorded_at,
    };
  }

  presentTelemetryHistory(rows) {
    return rows.map((row) => this.presentTelemetryPoint(row));
  }

  presentUser(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
    };
  }

  presentUsers(rows) {
    return rows.map((row) => this.presentUser(row));
  }

  created(row) {
    return { id: row.id };
  }

  updated() {
    return { updated: true };
  }

  deleted() {
    return { deleted: true };
  }
}

class AdminService {
  constructor(adminRepository) {
    this.adminRepository = adminRepository;
  }

  busNotFound() {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.BUS_NOT_FOUND,
      "El bus solicitado no existe.",
    );
  }

  stopNotFound() {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.STOP_NOT_FOUND,
      "La parada solicitada no existe.",
    );
  }

  incidentNotFound() {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.INCIDENT_NOT_FOUND,
      "El incidente solicitado no existe.",
    );
  }

  userNotFound() {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.USER_NOT_FOUND,
      "El usuario solicitado no existe.",
    );
  }

  async listBuses() {
    return this.adminRepository.listBuses();
  }

  async listStops(routeId) {
    return this.adminRepository.listStops(routeId);
  }

  async createStop(payload) {
    return this.adminRepository.createStop({
      route_id: payload.route_id,
      name: payload.name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      stop_order: payload.stop_order,
      geofence_radius_meters: payload.geofence_radius_meters,
    });
  }

  async deleteStop(id) {
    const existing = await this.adminRepository.deleteStop(id);
    if (!existing) {
      throw this.stopNotFound();
    }
    return existing;
  }

  async listIncidents(status) {
    return this.adminRepository.listIncidents(status);
  }

  async moderateIncident(id, moderationStatus, moderatorId) {
    const existing = await this.adminRepository.getIncidentById(id);
    if (!existing) {
      throw this.incidentNotFound();
    }

    const updated = await this.adminRepository.setIncidentModeration(
      id,
      moderationStatus,
      moderatorId,
    );
    if (!updated) {
      throw this.incidentNotFound();
    }
    return updated;
  }

  async getTelemetryHistory(tripId, startTime, endTime) {
    return this.adminRepository.getTelemetryHistory(tripId, startTime, endTime);
  }

  async listUsers(role) {
    return this.adminRepository.listUsers(role);
  }
}

class AdminController {
  constructor(adminService, adminPresenter) {
    this.adminService = adminService;
    this.adminPresenter = adminPresenter;
    this.listBuses = asyncHandler(this.listBuses.bind(this));
    this.listStops = asyncHandler(this.listStops.bind(this));
    this.createStop = asyncHandler(this.createStop.bind(this));
    this.deleteStop = asyncHandler(this.deleteStop.bind(this));
    this.listIncidents = asyncHandler(this.listIncidents.bind(this));
    this.moderateIncident = asyncHandler(this.moderateIncident.bind(this));
    this.getTelemetryHistory = asyncHandler(this.getTelemetryHistory.bind(this));
    this.listUsers = asyncHandler(this.listUsers.bind(this));
  }

  async listBuses(_req, res) {
    const rows = await this.adminService.listBuses();
    res.status(HTTP_STATUS.OK).json(this.adminPresenter.presentBuses(rows));
  }

  async listStops(req, res) {
    const rows = await this.adminService.listStops(req.valid.query.route_id);
    res.status(HTTP_STATUS.OK).json(this.adminPresenter.presentStops(rows));
  }

  async createStop(req, res) {
    const row = await this.adminService.createStop(req.valid.body);
    res.status(HTTP_STATUS.CREATED).json(this.adminPresenter.created(row));
  }

  async deleteStop(req, res) {
    await this.adminService.deleteStop(req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(this.adminPresenter.deleted());
  }

  async listIncidents(req, res) {
    const rows = await this.adminService.listIncidents(req.valid.query.status);
    res.status(HTTP_STATUS.OK).json(this.adminPresenter.presentIncidents(rows));
  }

  async moderateIncident(req, res) {
    const row = await this.adminService.moderateIncident(
      req.valid.params.id,
      req.valid.body.moderation_status,
      req.auth.userId,
    );
    res.status(HTTP_STATUS.OK).json(this.adminPresenter.presentIncident(row));
  }

  async getTelemetryHistory(req, res) {
    const rows = await this.adminService.getTelemetryHistory(
      req.valid.query.trip_id,
      req.valid.query.start_time,
      req.valid.query.end_time,
    );
    res.status(HTTP_STATUS.OK).json(this.adminPresenter.presentTelemetryHistory(rows));
  }

  async listUsers(req, res) {
    const rows = await this.adminService.listUsers(req.valid.query.role);
    res.status(HTTP_STATUS.OK).json(this.adminPresenter.presentUsers(rows));
  }
}

function createAdminModule(dependencies = {}) {
  const adminRepository = dependencies.adminRepository || new SupabaseAdminRepository();
  const adminPresenter = dependencies.adminPresenter || new AdminPresenter();
  const adminService = dependencies.adminService || new AdminService(adminRepository);
  const adminController = dependencies.adminController || new AdminController(adminService, adminPresenter);

  return {
    adminRepository,
    adminPresenter,
    adminService,
    adminController,
  };
}

function createAdminBusesRouter(dependencies = {}) {
  const { adminController } = createAdminModule(dependencies);
  const router = express.Router();

  router.use(requireAuth, requireRole(ROLES.ADMIN));
  router.get("/", adminController.listBuses);

  return router;
}

function createAdminStopsRouter(dependencies = {}) {
  const { adminController } = createAdminModule(dependencies);
  const router = express.Router();
  const validationCode = ERROR_CODES.STOP_VALIDATION_FAILED;

  router.use(requireAuth, requireRole(ROLES.ADMIN));

  router.get(
    "/",
    validate({ query: listStopsQuerySchema }, validationCode),
    adminController.listStops,
  );
  router.post(
    "/",
    validate({ body: stopSchema }, validationCode),
    adminController.createStop,
  );
  router.delete(
    "/:id",
    validate({ params: idParamSchema }, validationCode),
    adminController.deleteStop,
  );

  return router;
}

function createAdminIncidentsRouter(dependencies = {}) {
  const { adminController } = createAdminModule(dependencies);
  const router = express.Router();

  router.use(requireAuth, requireRole(ROLES.ADMIN));

  router.get(
    "/",
    validate({ query: listIncidentsQuerySchema }, ERROR_CODES.INCIDENT_VALIDATION_FAILED),
    adminController.listIncidents,
  );
  router.put(
    "/:id",
    validate(
      { params: idParamSchema, body: moderateIncidentSchema },
      ERROR_CODES.INCIDENT_MODERATION_INVALID,
    ),
    adminController.moderateIncident,
  );

  return router;
}

function createAdminTelemetryRouter(dependencies = {}) {
  const { adminController } = createAdminModule(dependencies);
  const router = express.Router();

  router.use(requireAuth, requireRole(ROLES.ADMIN));

  router.get(
    "/history",
    validate(
      { query: telemetryHistoryQuerySchema },
      ERROR_CODES.TELEMETRY_VALIDATION_FAILED,
    ),
    adminController.getTelemetryHistory,
  );

  return router;
}

function createAdminUsersRouter(dependencies = {}) {
  const { adminController } = createAdminModule(dependencies);
  const router = express.Router();

  router.use(requireAuth, requireRole(ROLES.ADMIN));

  router.get(
    "/",
    validate({ query: listUsersQuerySchema }, ERROR_CODES.USER_LIST_FAILED),
    adminController.listUsers,
  );

  return router;
}

module.exports = {
  AdminRepository,
  SupabaseAdminRepository,
  AdminPresenter,
  AdminService,
  AdminController,
  createAdminModule,
  createAdminBusesRouter,
  createAdminStopsRouter,
  createAdminIncidentsRouter,
  createAdminTelemetryRouter,
  createAdminUsersRouter,
};
