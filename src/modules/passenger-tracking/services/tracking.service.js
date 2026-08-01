"use strict";

const { haversineDistanceMeters } = require("../../../../utils/distance");
const AppError = require("../../../../utils/AppError");
const { HTTP_STATUS } = require("../../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../../constants/errorCodes");
const tripsRepository = require("../../../../repositories/tripsRepository");

const WATCH_STATUS = {
  WAITING: "waiting",
  APPROACHING: "alerted",
  PASSED: "passed",
};

const ALERT_EVENTS = {
  APPROACHING: "bus_approaching",
  PASSED: "bus_passed",
};

const DEFAULT_RADIUS_METERS = 500;
const DEFAULT_PASSED_CONFIRMATION_SAMPLES = 3;
const DEFAULT_PASSED_EXIT_BUFFER_METERS = 150;

class PassengerTrackingService {
  constructor(dependencies = {}) {
    this.watchRepository = dependencies.watchRepository;
    this.realtimeManager = dependencies.realtimeManager;
    this.tripRepository = dependencies.tripRepository || tripsRepository;
    this.pushService = dependencies.pushService || null;
    this.defaultRadiusMeters = dependencies.defaultRadiusMeters || DEFAULT_RADIUS_METERS;
    this.passedConfirmationSamples =
      dependencies.passedConfirmationSamples || DEFAULT_PASSED_CONFIRMATION_SAMPLES;
    this.passedExitBufferMeters =
      dependencies.passedExitBufferMeters == null
        ? DEFAULT_PASSED_EXIT_BUFFER_METERS
        : dependencies.passedExitBufferMeters;
    this.outOfRangeSamples = new Map();
  }

  async watchStop(userId, tripId, stopId) {
    const trip = await this.tripRepository.getTripById(tripId);
    if (!trip) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.TRIP_NOT_FOUND,
        "El viaje solicitado no existe.",
      );
    }

    const stop = await this.watchRepository.getStopById(stopId);
    if (!stop) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.WATCH_STOP_NOT_FOUND,
        "La parada solicitada no existe.",
      );
    }

    if (!trip.route_id || stop.route_id !== trip.route_id) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.WATCH_STOP_ROUTE_MISMATCH,
        "La parada no pertenece a la ruta del viaje.",
        { trip_route_id: trip.route_id || null, stop_route_id: stop.route_id || null },
      );
    }

    return this.watchRepository.addWatch(userId, tripId, stopId);
  }

  async checkProximity(tripId, currentLat, currentLng) {
    try {
      const activeWatches = await this.watchRepository.getActiveWatchesForTrip(tripId);

      this._pruneOutOfRangeSamples(tripId, activeWatches || []);

      if (!activeWatches || activeWatches.length === 0) return;

      const approaching = [];
      const passed = [];

      for (const watch of activeWatches) {
        const stop = watch.stops;
        if (!stop) continue;

        const radius = stop.geofence_radius_meters || this.defaultRadiusMeters;
        const distance = haversineDistanceMeters(currentLat, currentLng, stop.latitude, stop.longitude);
        const isInsideGeofence = distance <= radius;

        const sampleKey = this._sampleKey(tripId, watch.id);

        if (watch.status === WATCH_STATUS.WAITING && isInsideGeofence) {
          approaching.push(watch);
        } else if (watch.status === WATCH_STATUS.APPROACHING) {
          if (distance <= radius + this.passedExitBufferMeters) {
            this.outOfRangeSamples.delete(sampleKey);
          } else if (this._countOutOfRangeSample(sampleKey) >= this.passedConfirmationSamples) {
            this.outOfRangeSamples.delete(sampleKey);
            passed.push(watch);
          }
        }
      }

      await this._handleApproaching(approaching);
      await this._handlePassed(passed);
    } catch (err) {
      console.error("Error en checkProximity:", err.message);
    }
  }

  _sampleKey(tripId, watchId) {
    return `${tripId}|${watchId}`;
  }

  _countOutOfRangeSample(sampleKey) {
    const next = (this.outOfRangeSamples.get(sampleKey) || 0) + 1;
    this.outOfRangeSamples.set(sampleKey, next);
    return next;
  }

  _pruneOutOfRangeSamples(tripId, activeWatches) {
    if (this.outOfRangeSamples.size === 0) return;

    const prefix = `${tripId}|`;
    const activeKeys = new Set(activeWatches.map((watch) => this._sampleKey(tripId, watch.id)));

    for (const sampleKey of this.outOfRangeSamples.keys()) {
      if (sampleKey.startsWith(prefix) && !activeKeys.has(sampleKey)) {
        this.outOfRangeSamples.delete(sampleKey);
      }
    }
  }

  async _handleApproaching(watches) {
    if (watches.length === 0) return;

    for (const watch of watches) {
      this.outOfRangeSamples.delete(this._sampleKey(watch.trip_id, watch.id));
    }

    await this.watchRepository.markAsAlerted(watches.map((watch) => watch.id));

    for (const watch of watches) {
      await this._emitAlert(watch.user_id, ALERT_EVENTS.APPROACHING, {
        trip_id: watch.trip_id,
        stop_id: watch.stop_id,
      });
    }
  }

  async _handlePassed(watches) {
    for (const watch of watches) {
      const nextStop = await this._resolveNextStop(watch.stops);

      if (nextStop) {
        await this.watchRepository.redirectWatch(watch.id, nextStop.id);
      } else {
        await this.watchRepository.markAsPassed([watch.id]);
      }

      await this._emitAlert(watch.user_id, ALERT_EVENTS.PASSED, {
        trip_id: watch.trip_id,
        stop_id: watch.stop_id,
        redirected: Boolean(nextStop),
        next_stop: nextStop
          ? { id: nextStop.id, name: nextStop.name, stop_order: nextStop.stop_order }
          : null,
      });
    }
  }

  async _resolveNextStop(stop) {
    if (!stop || stop.route_id == null || stop.stop_order == null) return null;
    if (typeof this.watchRepository.getNextStop !== "function") return null;

    return this.watchRepository.getNextStop(stop.route_id, stop.stop_order);
  }

  async _emitAlert(userId, event, payload) {
    if (this.realtimeManager) {
      await this.realtimeManager.emitUserAlert(userId, event, payload);
    }

    if (this.pushService) {
      await this.pushService.sendAlert(userId, event, payload);
    }
  }
}

module.exports = PassengerTrackingService;
module.exports.WATCH_STATUS = WATCH_STATUS;
module.exports.ALERT_EVENTS = ALERT_EVENTS;
