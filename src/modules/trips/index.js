"use strict";

const express = require("express");
const { ROLES } = require("../../../constants/roles");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const { TRIP_STATUS, CONSUMER_VISIBLE_STATUSES } = require("../../../constants/tripStatus");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const requireRole = require("../../../middleware/requireRole");
const {
  createTripSchema,
  updateTripSchema,
  idParamSchema,
} = require("../../../models/tripSchema");
const tripsRepository = require("../../../repositories/tripsRepository");
const SupabaseTripRepository = require("./infrastructure/SupabaseTripRepository");

class TripRepository {
  async listTrips(_query) {
    throw new Error("TripRepository.listTrips must be implemented.");
  }

  async getTripById(_id) {
    throw new Error("TripRepository.getTripById must be implemented.");
  }

  async createTrip(_payload) {
    throw new Error("TripRepository.createTrip must be implemented.");
  }

  async updateTrip(_id, _payload) {
    throw new Error("TripRepository.updateTrip must be implemented.");
  }

  async setTripStatus(_id, _status) {
    throw new Error("TripRepository.setTripStatus must be implemented.");
  }
}

class TripPresenter {
  presentAdminTrip(row) {
    return {
      id: row.id,
      route_id: row.route_id,
      bus_id: row.bus_id,
      driver_id: row.driver_id,
      departure_time: row.departure_time,
      arrival_time: row.arrival_time,
      status: row.status,
      created_at: row.created_at,
      started_at: row.started_at,
      ended_at: row.ended_at,
    };
  }

  presentAdminTrips(rows) {
    return rows.map((row) => this.presentAdminTrip(row));
  }

  presentConsumerTrip(row) {
    return {
      id: row.id,
      route_id: row.route_id,
      bus_id: row.bus_id,
      departure_time: row.departure_time,
      arrival_time: row.arrival_time,
      status: row.status,
    };
  }

  presentConsumerTrips(rows) {
    return rows.map((row) => this.presentConsumerTrip(row));
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

  reactivated() {
    return { reactivated: true };
  }
}

class TripService {
  constructor(tripRepository) {
    this.tripRepository = tripRepository;
  }

  notFound() {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.TRIP_NOT_FOUND,
      "El viaje solicitado no existe.",
    );
  }

  async listAll() {
    return this.tripRepository.listTrips({});
  }

  async listVisible() {
    return this.tripRepository.listTrips({ statuses: CONSUMER_VISIBLE_STATUSES });
  }

  async getById(id) {
    const existing = await this.tripRepository.getTripById(id);
    if (!existing) {
      throw this.notFound();
    }
    return existing;
  }

  async create(payload) {
    const trip = {
      route_id: payload.route_id,
      bus_id: payload.bus_id,
      driver_id: payload.driver_id,
      departure_time: payload.departure_time,
    };
    if (payload.arrival_time !== undefined) {
      trip.arrival_time = payload.arrival_time;
    }
    if (payload.status !== undefined) {
      trip.status = payload.status;
    }
    return this.tripRepository.createTrip(trip);
  }

  async update(id, payload) {
    const existing = await this.tripRepository.getTripById(id);
    if (!existing) {
      throw this.notFound();
    }

    const patch = {};
    if (payload.route_id !== undefined) {
      patch.route_id = payload.route_id;
    }
    if (payload.bus_id !== undefined) {
      patch.bus_id = payload.bus_id;
    }
    if (payload.driver_id !== undefined) {
      patch.driver_id = payload.driver_id;
    }
    if (payload.departure_time !== undefined) {
      patch.departure_time = payload.departure_time;
    }
    if (payload.arrival_time !== undefined) {
      patch.arrival_time = payload.arrival_time;
    }
    if (payload.status !== undefined) {
      patch.status = payload.status;
    }

    const updated = await this.tripRepository.updateTrip(id, patch);
    if (!updated) {
      throw this.notFound();
    }
    return updated;
  }

  async deactivate(id) {
    const existing = await this.tripRepository.getTripById(id);
    if (!existing) {
      throw this.notFound();
    }
    return this.tripRepository.setTripStatus(id, TRIP_STATUS.CANCELLED);
  }

  async reactivate(id) {
    const existing = await this.tripRepository.getTripById(id);
    if (!existing) {
      throw this.notFound();
    }
    return this.tripRepository.setTripStatus(id, TRIP_STATUS.SCHEDULED);
  }
}

class TripController {
  constructor(tripService, tripPresenter) {
    this.tripService = tripService;
    this.tripPresenter = tripPresenter;
    this.listAdminTrips = asyncHandler(this.listAdminTrips.bind(this));
    this.getTrip = asyncHandler(this.getTrip.bind(this));
    this.createTrip = asyncHandler(this.createTrip.bind(this));
    this.updateTrip = asyncHandler(this.updateTrip.bind(this));
    this.deactivateTrip = asyncHandler(this.deactivateTrip.bind(this));
    this.reactivateTrip = asyncHandler(this.reactivateTrip.bind(this));
    this.listConsumerTrips = asyncHandler(this.listConsumerTrips.bind(this));
  }

  async listAdminTrips(_req, res) {
    const rows = await this.tripService.listAll();
    res.status(HTTP_STATUS.OK).json(this.tripPresenter.presentAdminTrips(rows));
  }

  async getTrip(req, res) {
    const row = await this.tripService.getById(req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(this.tripPresenter.presentAdminTrip(row));
  }

  async createTrip(req, res) {
    const row = await this.tripService.create(req.valid.body);
    res.status(HTTP_STATUS.CREATED).json(this.tripPresenter.created(row));
  }

  async updateTrip(req, res) {
    await this.tripService.update(req.valid.params.id, req.valid.body);
    res.status(HTTP_STATUS.OK).json(this.tripPresenter.updated());
  }

  async deactivateTrip(req, res) {
    await this.tripService.deactivate(req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(this.tripPresenter.deleted());
  }

  async reactivateTrip(req, res) {
    await this.tripService.reactivate(req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(this.tripPresenter.reactivated());
  }

  async listConsumerTrips(_req, res) {
    const rows = await this.tripService.listVisible();
    res.status(HTTP_STATUS.OK).json(this.tripPresenter.presentConsumerTrips(rows));
  }
}

function createTripModule(dependencies = {}) {
  const tripRepository =
    dependencies.tripRepository ||
    (dependencies.useConcreteRepository ? new SupabaseTripRepository() : tripsRepository);
  const tripPresenter = dependencies.tripPresenter || new TripPresenter();
  const tripService = dependencies.tripService || new TripService(tripRepository);
  const tripController = dependencies.tripController || new TripController(tripService, tripPresenter);

  return {
    tripRepository,
    tripPresenter,
    tripService,
    tripController,
  };
}

function createAdminTripsRouter(dependencies = {}) {
  const { tripController } = createTripModule(dependencies);
  const router = express.Router();
  const validationCode = ERROR_CODES.TRIP_VALIDATION_FAILED;

  router.use(requireAuth, requireRole(ROLES.ADMIN));

  router.get("/", tripController.listAdminTrips);
  router.post(
    "/",
    validate({ body: createTripSchema }, validationCode),
    tripController.createTrip,
  );
  router.get(
    "/:id",
    validate({ params: idParamSchema }, validationCode),
    tripController.getTrip,
  );
  router.put(
    "/:id",
    validate({ params: idParamSchema, body: updateTripSchema }, validationCode),
    tripController.updateTrip,
  );
  router.delete(
    "/:id",
    validate({ params: idParamSchema }, validationCode),
    tripController.deactivateTrip,
  );
  router.post(
    "/:id/reactivate",
    validate({ params: idParamSchema }, validationCode),
    tripController.reactivateTrip,
  );

  return router;
}

function createConsumerTripsRouter(dependencies = {}) {
  const { tripController } = createTripModule(dependencies);
  const router = express.Router();

  router.use(requireAuth);
  router.get("/", tripController.listConsumerTrips);

  return router;
}

module.exports = {
  TripRepository,
  SupabaseTripRepository,
  TripPresenter,
  TripService,
  TripController,
  createTripModule,
  createAdminTripsRouter,
  createConsumerTripsRouter,
};