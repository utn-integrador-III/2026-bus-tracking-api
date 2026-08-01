"use strict";

const { haversineDistanceMeters } = require("../../../../utils/distance");

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

const ALERT_FAILURE_STAGES = {
  WATCH_QUERY: "watch_query_failed",
  ALERT_DISPATCH: "alert_dispatch_failed",
};

class PassengerTrackingService {
  constructor(dependencies = {}) {
    this.watchRepository = dependencies.watchRepository;
    this.realtimeManager = dependencies.realtimeManager;
    this.defaultRadiusMeters = dependencies.defaultRadiusMeters || DEFAULT_RADIUS_METERS;
    this.alertFailures = { total: 0, byStage: {}, lastFailure: null };
  }

  getAlertFailureStats() {
    return {
      total: this.alertFailures.total,
      byStage: { ...this.alertFailures.byStage },
      lastFailure: this.alertFailures.lastFailure,
    };
  }

  _recordAlertFailure(stage, tripId, err) {
    this.alertFailures.total += 1;
    this.alertFailures.byStage[stage] = (this.alertFailures.byStage[stage] || 0) + 1;
    this.alertFailures.lastFailure = {
      stage,
      trip_id: tripId,
      message: err.message,
      at: new Date().toISOString(),
    };

    console.error(
      JSON.stringify({
        scope: "geofence_alerts",
        level: "error",
        event: stage,
        trip_id: tripId,
        error: err.message,
        error_code: err.code || null,
        failure_total: this.alertFailures.total,
      }),
    );
  }

  async watchStop(userId, tripId, stopId) {
    return this.watchRepository.addWatch(userId, tripId, stopId);
  }

  async checkProximity(tripId, currentLat, currentLng) {
    let activeWatches;

    try {
      activeWatches = await this.watchRepository.getActiveWatchesForTrip(tripId);
    } catch (err) {
      this._recordAlertFailure(ALERT_FAILURE_STAGES.WATCH_QUERY, tripId, err);
      return;
    }

    if (!activeWatches || activeWatches.length === 0) return;

    try {
      const approaching = [];
      const passed = [];

      for (const watch of activeWatches) {
        const stop = watch.stops;
        if (!stop) continue;

        const radius = stop.geofence_radius_meters || this.defaultRadiusMeters;
        const distance = haversineDistanceMeters(currentLat, currentLng, stop.latitude, stop.longitude);
        const isInsideGeofence = distance <= radius;

        if (watch.status === WATCH_STATUS.WAITING && isInsideGeofence) {
          approaching.push(watch);
        } else if (watch.status === WATCH_STATUS.APPROACHING && !isInsideGeofence) {
          passed.push(watch);
        }
      }

      await this._handleApproaching(approaching);
      await this._handlePassed(passed);
    } catch (err) {
      this._recordAlertFailure(ALERT_FAILURE_STAGES.ALERT_DISPATCH, tripId, err);
    }
  }

  async _handleApproaching(watches) {
    if (watches.length === 0) return;

    await this.watchRepository.markAsAlerted(watches.map((watch) => watch.id));

    for (const watch of watches) {
      this._emitAlert(watch.user_id, ALERT_EVENTS.APPROACHING, {
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

      this._emitAlert(watch.user_id, ALERT_EVENTS.PASSED, {
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

  _emitAlert(userId, event, payload) {
    if (!this.realtimeManager) return;
    this.realtimeManager.emitUserAlert(userId, event, payload);
  }
}

module.exports = PassengerTrackingService;
module.exports.WATCH_STATUS = WATCH_STATUS;
module.exports.ALERT_EVENTS = ALERT_EVENTS;
module.exports.ALERT_FAILURE_STAGES = ALERT_FAILURE_STAGES;
