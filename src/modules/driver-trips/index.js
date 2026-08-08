"use strict";

const express = require("express");
const { z } = require("zod");
const { ROLES } = require("../../../constants/roles");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const { TRIP_STATUS } = require("../../../constants/tripStatus");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const requireRole = require("../../../middleware/requireRole");
const { idParamSchema } = require("../../../models/tripSchema");
const { reportLocationSchema } = require("../../../models/driverTrip.model");
const { normalizeReportType } = require("../../../models/incident.model");
const { REPORT_TYPE_VALUES } = require("../../../constants/reportType");
const tripsRepository = require("../../../repositories/tripsRepository");
const locationRepository = require("../../../repositories/locationRepository");
const incidentsRepository = require("../../../repositories/incidentsRepository");
const realtimeManager = require("../../../realtime/index");
const routesRepository = require("../../../repositories/routesRepository");
const googleRoutesService = require("../../../services/googleRoutes.service");
const {
  PassengerTrackingService,
  SupabaseTripWatchRepository,
  ExpoPushService,
} = require("../passenger-tracking/index");
const { env } = require("../../../config/env");

const ACTIVE_STATUSES = [TRIP_STATUS.IN_PROGRESS];
const STARTABLE_STATUSES = [TRIP_STATUS.SCHEDULED, TRIP_STATUS.PENDING];
const ASSIGNED_STATUSES = [
  TRIP_STATUS.SCHEDULED,
  TRIP_STATUS.PENDING,
  TRIP_STATUS.IN_PROGRESS,
];

const driverIncidentSchema = z
  .object({
    trip_id: z.string().uuid(),
    type: z.preprocess(normalizeReportType, z.enum(REPORT_TYPE_VALUES)),
    description: z.string().trim().min(1).max(500),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    speed: z.number().min(0).optional(),
  })
  .strict();

class DriverTripService {
  constructor(dependencies = {}) {
    this.tripRepository = dependencies.tripRepository || tripsRepository;
    this.locationRepository = dependencies.locationRepository || locationRepository;
    this.realtimeManager = dependencies.realtimeManager || realtimeManager;
    this.routesRepository = dependencies.routesRepository || routesRepository;
    this.googleRoutesService = dependencies.googleRoutesService || googleRoutesService;
    this.trackingService = dependencies.trackingService;
  }

  _notFound() {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.TRIP_NOT_FOUND,
      "El viaje solicitado no existe.",
    );
  }

  _forbidden(message) {
    return new AppError(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN_ROLE, message);
  }

  _conflict(message) {
    return new AppError(HTTP_STATUS.CONFLICT, ERROR_CODES.TRIP_VALIDATION_FAILED, message);
  }

  async _getTripOrFail(tripId) {
    const trip = await this.tripRepository.getTripById(tripId);
    if (!trip) {
      throw this._notFound();
    }
    return trip;
  }

  _assertDriverOwnership(trip, driverId) {
    if (trip.driver_id !== driverId) {
      throw this._forbidden("This trip is not assigned to the authenticated driver.");
    }
  }

  async startTrip(driverId, tripId) {
    const trip = await this._getTripOrFail(tripId);
    this._assertDriverOwnership(trip, driverId);

    if (!STARTABLE_STATUSES.includes(trip.status)) {
      throw this._conflict(
        `Trip cannot be started. Current status: ${trip.status}. Expected: ${STARTABLE_STATUSES.join(" or ")}.`,
      );
    }

    const now = new Date().toISOString();
    const updated = await this.tripRepository.updateTrip(tripId, {
      status: TRIP_STATUS.IN_PROGRESS,
      started_at: now,
    });

    await this.realtimeManager.startTracking(tripId);

    return updated;
  }

  async completeTrip(driverId, tripId) {
    const trip = await this._getTripOrFail(tripId);
    this._assertDriverOwnership(trip, driverId);

    if (trip.status !== TRIP_STATUS.IN_PROGRESS) {
      throw this._conflict(
        `Only in-progress trips can be completed. Current status: ${trip.status}.`,
      );
    }

    const now = new Date().toISOString();
    const updated = await this.tripRepository.updateTrip(tripId, {
      status: TRIP_STATUS.COMPLETED,
      ended_at: now,
    });

    await this.realtimeManager.stopTracking(tripId);

    return updated;
  }

  async cancelTrip(driverId, tripId) {
    const trip = await this._getTripOrFail(tripId);
    this._assertDriverOwnership(trip, driverId);

    if (trip.status === TRIP_STATUS.COMPLETED || trip.status === TRIP_STATUS.CANCELLED) {
      throw this._conflict(
        `Trip cannot be cancelled. Current status: ${trip.status}.`,
      );
    }

    const updated = await this.tripRepository.updateTrip(tripId, {
      status: TRIP_STATUS.CANCELLED,
      ended_at: new Date().toISOString(),
    });

    await this.realtimeManager.stopTracking(tripId);

    return updated;
  }

  async getActiveTrip(driverId) {
    const trips = await this.tripRepository.findTripsByDriverId(driverId, ACTIVE_STATUSES);
    return trips.length > 0 ? trips[0] : null;
  }

  async listAssignedTrips(driverId) {
    return this.tripRepository.findTripsByDriverId(driverId, ASSIGNED_STATUSES);
  }

  async reportLocation(driverId, tripId, data) {
    const trip = await this._getTripOrFail(tripId);
    this._assertDriverOwnership(trip, driverId);

    if (trip.status !== TRIP_STATUS.IN_PROGRESS) {
      throw this._conflict(
        `Location can only be reported for in-progress trips. Current status: ${trip.status}.`,
      );
    }

    const location = await this.locationRepository.createLocation({
      trip_id: tripId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed ?? null,
      heading: data.heading ?? null,
      recorded_at: data.recorded_at || new Date().toISOString(),
    });

    let eta = null;
    if (env.enableGoogleRoutes) {
      try {
        const route = await this.routesRepository.getRouteById(trip.route_id);
        if (route && route.geometry_geojson) {
          const coordinates =
            route.geometry_geojson.type === "Feature"
              ? route.geometry_geojson.geometry.coordinates
              : route.geometry_geojson.coordinates;
          if (coordinates && coordinates.length > 0) {
            const dest = coordinates[coordinates.length - 1];
            const routeData = await this.googleRoutesService.computeRoute({
              origin: { latitude: data.latitude, longitude: data.longitude },
              destination: { latitude: dest[1], longitude: dest[0] },
            });
            eta = routeData.duration;
          }
        }
      } catch (err) {
        console.error("Error computing ETA:", err.message);
      }
    }

    await this.realtimeManager.broadcastLocation(tripId, location, eta);

    if (this.trackingService) {
      await this.trackingService.checkProximity(tripId, data.latitude, data.longitude);
    }

    return location;
  }
}

class DriverIncidentService {
  constructor(dependencies = {}) {
    this.tripRepository = dependencies.tripRepository || tripsRepository;
    this.locationRepository = dependencies.locationRepository || locationRepository;
    this.incidentsRepository = dependencies.incidentsRepository || incidentsRepository;
  }

  _speedLocked(speed, source) {
    return new AppError(
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.DRIVER_INCIDENT_SPEED_LOCKED,
      "No se puede reportar un incidente con el vehiculo en movimiento.",
      { speed, source },
    );
  }

  async _assertVehicleStopped(tripId, requestedSpeed) {
    if (requestedSpeed != null && requestedSpeed > 0) {
      throw this._speedLocked(requestedSpeed, "request");
    }

    const latest = await this.locationRepository.getLatestByTripId(tripId);
    if (latest && latest.speed != null && latest.speed > 0) {
      throw this._speedLocked(latest.speed, "telemetry");
    }
  }

  async createIncident(driverId, data) {
    const trip = await this.tripRepository.getTripById(data.trip_id);
    if (!trip) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        "El viaje solicitado no existe.",
      );
    }

    if (trip.driver_id !== driverId) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN_ROLE,
        "This trip is not assigned to the authenticated driver.",
      );
    }

    await this._assertVehicleStopped(data.trip_id, data.speed);

    return this.incidentsRepository.createPassengerIncident({
      trip_id: data.trip_id,
      user_id: driverId,
      type: data.type,
      description: data.description ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  }
}

class DriverIncidentController {
  constructor(service) {
    this.service = service;
    this.createIncident = asyncHandler(this.createIncident.bind(this));
  }

  async createIncident(req, res) {
    const incident = await this.service.createIncident(req.auth.userId, req.valid.body);
    res.status(HTTP_STATUS.CREATED).json(incident);
  }
}

class DriverTripController {
  constructor(service) {
    this.service = service;
    this.startTrip = asyncHandler(this.startTrip.bind(this));
    this.completeTrip = asyncHandler(this.completeTrip.bind(this));
    this.cancelTrip = asyncHandler(this.cancelTrip.bind(this));
    this.getActiveTrip = asyncHandler(this.getActiveTrip.bind(this));
    this.listAssignedTrips = asyncHandler(this.listAssignedTrips.bind(this));
    this.reportLocation = asyncHandler(this.reportLocation.bind(this));
  }

  _extractDriverId(req) {
    return req.auth.userId;
  }

  async startTrip(req, res) {
    const driverId = this._extractDriverId(req);
    const trip = await this.service.startTrip(driverId, req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(trip);
  }

  async completeTrip(req, res) {
    const driverId = this._extractDriverId(req);
    const trip = await this.service.completeTrip(driverId, req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(trip);
  }

  async cancelTrip(req, res) {
    const driverId = this._extractDriverId(req);
    const trip = await this.service.cancelTrip(driverId, req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(trip);
  }

  async getActiveTrip(req, res) {
    const driverId = this._extractDriverId(req);
    const trip = await this.service.getActiveTrip(driverId);
    res.status(HTTP_STATUS.OK).json(trip);
  }

  async listAssignedTrips(req, res) {
    const driverId = this._extractDriverId(req);
    const trips = await this.service.listAssignedTrips(driverId);
    res.status(HTTP_STATUS.OK).json(trips);
  }

  async reportLocation(req, res) {
    const driverId = this._extractDriverId(req);
    const location = await this.service.reportLocation(
      driverId,
      req.valid.params.id,
      req.valid.body,
    );
    res.status(HTTP_STATUS.CREATED).json(location);
  }
}

function createDriverTripModule(dependencies = {}) {
  const driverTripService =
    dependencies.driverTripService ||
    new DriverTripService({
      tripRepository: dependencies.tripRepository,
      locationRepository: dependencies.locationRepository,
      realtimeManager: dependencies.realtimeManager,
      routesRepository: dependencies.routesRepository,
      googleRoutesService: dependencies.googleRoutesService,
      trackingService: dependencies.trackingService || new PassengerTrackingService({
        watchRepository: new SupabaseTripWatchRepository(),
        realtimeManager: dependencies.realtimeManager || realtimeManager,
        pushService: dependencies.pushService || new ExpoPushService(),
      }),
    });
  const driverTripController =
    dependencies.driverTripController || new DriverTripController(driverTripService);

  return {
    driverTripService,
    driverTripController,
  };
}

function createDriverTripsRouter(dependencies = {}) {
  const { driverTripController } = createDriverTripModule(dependencies);
  const router = express.Router();
  const validationCode = ERROR_CODES.TRIP_VALIDATION_FAILED;

  router.use(requireAuth, requireRole(ROLES.DRIVER));

  router.get("/", driverTripController.listAssignedTrips);

  router.get("/active", driverTripController.getActiveTrip);

  router.post(
    "/:id/start",
    validate({ params: idParamSchema }, validationCode),
    driverTripController.startTrip,
  );

  router.post(
    "/:id/complete",
    validate({ params: idParamSchema }, validationCode),
    driverTripController.completeTrip,
  );

  router.post(
    "/:id/cancel",
    validate({ params: idParamSchema }, validationCode),
    driverTripController.cancelTrip,
  );

  router.post(
    "/:id/location",
    validate({ params: idParamSchema, body: reportLocationSchema }, validationCode),
    driverTripController.reportLocation,
  );

  return router;
}

function createDriverIncidentsRouter(dependencies = {}) {
  const driverIncidentService =
    dependencies.driverIncidentService || new DriverIncidentService(dependencies);
  const driverIncidentController =
    dependencies.driverIncidentController || new DriverIncidentController(driverIncidentService);

  const router = express.Router();

  router.use(requireAuth, requireRole(ROLES.DRIVER));

  router.post(
    "/",
    validate({ body: driverIncidentSchema }, ERROR_CODES.DRIVER_INCIDENT_VALIDATION_FAILED),
    driverIncidentController.createIncident,
  );

  return router;
}

module.exports = {
  DriverTripService,
  DriverTripController,
  DriverIncidentService,
  DriverIncidentController,
  createDriverTripModule,
  createDriverTripsRouter,
  createDriverIncidentsRouter,
};
