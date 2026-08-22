"use strict";

const express = require("express");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const { ROLES } = require("../../../constants/roles");
const { TRIP_STATUS } = require("../../../constants/tripStatus");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const requireAuth = require("../../../middleware/requireAuth");
const requireRole = require("../../../middleware/requireRole");
const validate = require("../../../middleware/validate");
const { idParamSchema } = require("../../../models/tripSchema");
const {
  installationIdParamSchema,
  notificationIdParamSchema,
  upsertPushDeviceSchema,
  notificationPreferencesSchema,
  tripSubscriptionSchema,
  listNotificationsQuerySchema,
} = require("../../../models/notification.model");
const tripsRepository = require("../../../repositories/tripsRepository");
const SupabaseNotificationRepository = require("./infrastructure/SupabaseNotificationRepository");

class NotificationService {
  constructor(dependencies = {}) {
    this.repository = dependencies.repository;
    this.tripRepository = dependencies.tripRepository;
  }

  notFound(code, message) {
    return new AppError(HTTP_STATUS.NOT_FOUND, code, message);
  }

  validationError(message) {
    return new AppError(
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.TRIP_SUBSCRIPTION_VALIDATION_FAILED,
      message,
    );
  }

  async registerDevice(userId, installationId, payload) {
    return this.repository.upsertPushDevice(userId, installationId, payload);
  }

  async removeDevice(userId, installationId) {
    const device = await this.repository.deactivatePushDevice(userId, installationId);
    if (!device) {
      throw this.notFound(
        ERROR_CODES.PUSH_DEVICE_NOT_FOUND,
        "El dispositivo push solicitado no existe.",
      );
    }
    return device;
  }

  async updatePreferences(userId, patch) {
    const current = await this.repository.getNotificationPreferences(userId);
    if (current === null) {
      throw this.notFound(ERROR_CODES.NOTIFICATION_NOT_FOUND, "El perfil de pasajero no existe.");
    }
    return this.repository.updateNotificationPreferences(userId, { ...current, ...patch });
  }

  async subscribeToTrip(userId, tripId, payload) {
    const trip = await this.tripRepository.getTripById(tripId);
    if (!trip) {
      throw this.notFound(ERROR_CODES.TRIP_NOT_FOUND, "El viaje solicitado no existe.");
    }
    if ([TRIP_STATUS.CANCELLED, TRIP_STATUS.COMPLETED].includes(trip.status)) {
      throw this.validationError("No se puede seguir un viaje finalizado o cancelado.");
    }
    if (
      payload.boarding_stop_id &&
      payload.boarding_stop_id === payload.destination_stop_id
    ) {
      throw this.validationError("La parada de abordaje y destino deben ser diferentes.");
    }

    const stopIds = [payload.boarding_stop_id, payload.destination_stop_id].filter(Boolean);
    const stops = await this.repository.findStopsByIds([...new Set(stopIds)]);
    if (stops.length !== new Set(stopIds).size || stops.some((stop) => stop.route_id !== trip.route_id)) {
      throw this.validationError("Las paradas deben pertenecer a la ruta del viaje.");
    }

    return this.repository.upsertTripSubscription(userId, tripId, payload);
  }

  async unsubscribeFromTrip(userId, tripId) {
    const subscription = await this.repository.exitTripSubscription(userId, tripId);
    if (!subscription) {
      throw this.notFound(
        ERROR_CODES.TRIP_SUBSCRIPTION_NOT_FOUND,
        "La suscripción al viaje no existe.",
      );
    }
    return subscription;
  }

  async listNotifications(userId, query) {
    return this.repository.listNotifications(userId, query);
  }

  async markRead(userId, notificationId) {
    const notification = await this.repository.markNotificationRead(userId, notificationId);
    if (!notification) {
      throw this.notFound(ERROR_CODES.NOTIFICATION_NOT_FOUND, "La notificación no existe.");
    }
    return notification;
  }
}

class NotificationController {
  constructor(service) {
    this.service = service;
    this.registerDevice = asyncHandler(this.registerDevice.bind(this));
    this.removeDevice = asyncHandler(this.removeDevice.bind(this));
    this.updatePreferences = asyncHandler(this.updatePreferences.bind(this));
    this.subscribeToTrip = asyncHandler(this.subscribeToTrip.bind(this));
    this.unsubscribeFromTrip = asyncHandler(this.unsubscribeFromTrip.bind(this));
    this.listNotifications = asyncHandler(this.listNotifications.bind(this));
    this.markRead = asyncHandler(this.markRead.bind(this));
  }

  async registerDevice(req, res) {
    const device = await this.service.registerDevice(
      req.auth.userId,
      req.valid.params.installationId,
      req.valid.body,
    );
    res.status(HTTP_STATUS.OK).json(device);
  }

  async removeDevice(req, res) {
    await this.service.removeDevice(req.auth.userId, req.valid.params.installationId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  async updatePreferences(req, res) {
    const preferences = await this.service.updatePreferences(req.auth.userId, req.valid.body);
    res.status(HTTP_STATUS.OK).json(preferences);
  }

  async subscribeToTrip(req, res) {
    const subscription = await this.service.subscribeToTrip(
      req.auth.userId,
      req.valid.params.id,
      req.valid.body,
    );
    res.status(HTTP_STATUS.OK).json(subscription);
  }

  async unsubscribeFromTrip(req, res) {
    await this.service.unsubscribeFromTrip(req.auth.userId, req.valid.params.id);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  async listNotifications(req, res) {
    const notifications = await this.service.listNotifications(req.auth.userId, req.valid.query);
    res.status(HTTP_STATUS.OK).json(notifications);
  }

  async markRead(req, res) {
    const notification = await this.service.markRead(req.auth.userId, req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(notification);
  }
}

function createNotificationModule(dependencies = {}) {
  const repository = dependencies.repository || new SupabaseNotificationRepository();
  const service = dependencies.service || new NotificationService({
    repository,
    tripRepository: dependencies.tripRepository || tripsRepository,
  });
  const controller = dependencies.controller || new NotificationController(service);
  return { repository, service, controller };
}

function createPassengerNotificationRouter(dependencies = {}) {
  const { controller } = createNotificationModule(dependencies);
  const router = express.Router();

  router.use(requireAuth, requireRole(ROLES.PASSENGER));
  router.put(
    "/push-devices/:installationId",
    validate(
      { params: installationIdParamSchema, body: upsertPushDeviceSchema },
      ERROR_CODES.PUSH_DEVICE_VALIDATION_FAILED,
    ),
    controller.registerDevice,
  );
  router.delete(
    "/push-devices/:installationId",
    validate({ params: installationIdParamSchema }, ERROR_CODES.PUSH_DEVICE_VALIDATION_FAILED),
    controller.removeDevice,
  );
  router.patch(
    "/notification-preferences",
    validate({ body: notificationPreferencesSchema }, ERROR_CODES.NOTIFICATION_VALIDATION_FAILED),
    controller.updatePreferences,
  );
  router.post(
    "/trips/:id/subscription",
    validate(
      { params: idParamSchema, body: tripSubscriptionSchema },
      ERROR_CODES.TRIP_SUBSCRIPTION_VALIDATION_FAILED,
    ),
    controller.subscribeToTrip,
  );
  router.delete(
    "/trips/:id/subscription",
    validate({ params: idParamSchema }, ERROR_CODES.TRIP_SUBSCRIPTION_VALIDATION_FAILED),
    controller.unsubscribeFromTrip,
  );
  router.get(
    "/notifications",
    validate({ query: listNotificationsQuerySchema }, ERROR_CODES.NOTIFICATION_VALIDATION_FAILED),
    controller.listNotifications,
  );
  router.patch(
    "/notifications/:id/read",
    validate({ params: notificationIdParamSchema }, ERROR_CODES.NOTIFICATION_VALIDATION_FAILED),
    controller.markRead,
  );

  return router;
}

module.exports = {
  NotificationService,
  NotificationController,
  SupabaseNotificationRepository,
  createNotificationModule,
  createPassengerNotificationRouter,
};
