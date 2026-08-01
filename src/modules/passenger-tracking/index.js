"use strict";

const express = require("express");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const asyncHandler = require("../../../utils/asyncHandler");
const requireAuth = require("../../../middleware/requireAuth");
const validate = require("../../../middleware/validate");
const { z } = require("zod");
const SupabaseTripWatchRepository = require("./infrastructure/SupabaseTripWatchRepository");
const PassengerTrackingService = require("./services/tracking.service");
const PassengerPushTokenService = require("./services/pushToken.service");
const { EXPO_PUSH_TOKEN_PATTERN } = require("./services/pushToken.service");
const realtimeManager = require("../../../realtime/index");
const { idParamSchema } = require("../../../models/tripSchema");
const tripsRepository = require("../../../repositories/tripsRepository");
const routesRepository = require("../../../repositories/routesRepository");
const { CONSUMER_VISIBLE_STATUSES } = require("../../../constants/tripStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");

const watchStopBodySchema = z.object({
  stop_id: z.string().uuid(),
}).strict();

const pushTokenBodySchema = z.object({
  expo_push_token: z
    .string()
    .trim()
    .regex(EXPO_PUSH_TOKEN_PATTERN, "Se espera un token de Expo con formato ExponentPushToken[...]."),
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
    const activeTrips = await tripsRepository.listTrips({ statuses: CONSUMER_VISIBLE_STATUSES });

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

class PassengerPushTokenController {
  constructor(pushTokenService) {
    this.pushTokenService = pushTokenService;
    this.registerToken = asyncHandler(this.registerToken.bind(this));
  }

  async registerToken(req, res) {
    const userId = req.auth.userId;
    const expoPushToken = req.valid.body.expo_push_token;

    const profile = await this.pushTokenService.registerToken(userId, expoPushToken);

    res.status(HTTP_STATUS.OK).json({
      user_id: profile ? profile.user_id : userId,
      expo_push_token: profile ? profile.expo_push_token : expoPushToken,
    });
  }
}

function createPassengerPushTokenRouter(dependencies = {}) {
  const pushTokenService = dependencies.pushTokenService || new PassengerPushTokenService();
  const pushTokenController =
    dependencies.pushTokenController || new PassengerPushTokenController(pushTokenService);

  const router = express.Router();

  router.use(requireAuth);

  router.post(
    "/",
    validate({ body: pushTokenBodySchema }, ERROR_CODES.PUSH_TOKEN_VALIDATION_FAILED),
    pushTokenController.registerToken,
  );

  return router;
}

function createPassengerTrackingModule(dependencies = {}) {
  const watchRepository = dependencies.watchRepository || new SupabaseTripWatchRepository();
  const trackingService = dependencies.trackingService || new PassengerTrackingService({
    watchRepository,
    realtimeManager: dependencies.realtimeManager || realtimeManager,
  });
  const trackingController = dependencies.trackingController || new PassengerTrackingController(trackingService);

  return { watchRepository, trackingService, trackingController };
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
  PassengerPushTokenService,
  PassengerPushTokenController,
  createPassengerTrackingModule,
  createPassengerTrackingRouter,
  createPassengerPushTokenRouter,
};
