"use strict";

const express = require("express");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const asyncHandler = require("../../../utils/asyncHandler");
const requireAuth = require("../../../middleware/requireAuth");
const validate = require("../../../middleware/validate");
const { z } = require("zod");
const SupabaseTripWatchRepository = require("./infrastructure/SupabaseTripWatchRepository");
const PassengerTrackingService = require("./services/tracking.service");
const realtimeManager = require("../../../realtime/index");
const { PushNotificationsService } = require("../../../services/pushNotifications.service");
const { idParamSchema } = require("../../../models/tripSchema");
const tripsRepository = require("../../../repositories/tripsRepository");
const routesRepository = require("../../../repositories/routesRepository");
const { CONSUMER_VISIBLE_STATUSES } = require("../../../constants/tripStatus");

const watchStopBodySchema = z.object({
  stop_id: z.string().uuid(),
}).strict();

class PassengerTrackingController {
  constructor(trackingService) {
    this.trackingService = trackingService;
    this.watchStop = asyncHandler(this.watchStop.bind(this));
    this.previewActiveTrips = asyncHandler(this.previewActiveTrips.bind(this));
  }

  async watchStop(req, res) {
    const userId = req.auth.userId;
    const tripId = req.valid.params.id;
    const stopId = req.valid.body.stop_id;

    const data = await this.trackingService.watchStop(userId, tripId, stopId);
    res.status(HTTP_STATUS.CREATED).json(data);
  }

  async previewActiveTrips(req, res) {
    // Basic preview: we return the active trips. 
    // In a real scenario with full DB joins, we'd include route geometry and stops in a single query.
    // We'll simulate the response shape for the frontend.
    const activeTrips = await tripsRepository.listTrips({ statuses: CONSUMER_VISIBLE_STATUSES });
    
    // As an optimization, fetch route info for each active trip (or frontend can do this)
    const tripsWithRoutes = await Promise.all(activeTrips.map(async (trip) => {
      let route = null;
      if (trip.route_id) {
        route = await routesRepository.getRouteById(trip.route_id);
      }
      return {
        ...trip,
        route,
      };
    }));

    res.status(HTTP_STATUS.OK).json(tripsWithRoutes);
  }
}

function createPassengerTrackingModule(dependencies = {}) {
  const watchRepository = dependencies.watchRepository || new SupabaseTripWatchRepository();
  const pushService = dependencies.pushService || new PushNotificationsService();
  const trackingService = dependencies.trackingService || new PassengerTrackingService({
    watchRepository,
    realtimeManager: dependencies.realtimeManager || realtimeManager,
    pushService,
  });
  const trackingController = dependencies.trackingController || new PassengerTrackingController(trackingService);

  return { watchRepository, pushService, trackingService, trackingController };
}

function createPassengerTrackingRouter(dependencies = {}) {
  const { trackingController } = createPassengerTrackingModule(dependencies);
  const router = express.Router();

  router.use(requireAuth);

  router.get("/trips/preview", trackingController.previewActiveTrips);

  router.post(
    "/trips/:id/watch-stop",
    validate({ params: idParamSchema, body: watchStopBodySchema }),
    trackingController.watchStop
  );

  return router;
}

module.exports = {
  SupabaseTripWatchRepository,
  PassengerTrackingService,
  PassengerTrackingController,
  createPassengerTrackingModule,
  createPassengerTrackingRouter,
};
