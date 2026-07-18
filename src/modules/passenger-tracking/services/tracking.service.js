"use strict";

const { haversineDistanceMeters } = require("../../../../utils/distance");
const { env } = require("../../../../config/env");

class PassengerTrackingService {
  constructor(dependencies = {}) {
    this.watchRepository = dependencies.watchRepository;
    this.realtimeManager = dependencies.realtimeManager;
    this.pushService = dependencies.pushService;
    this.defaultRadiusMeters = dependencies.defaultRadiusMeters ?? env.stopProximityRadiusMeters;
  }

  async watchStop(userId, tripId, stopId) {
    return this.watchRepository.addWatch(userId, tripId, stopId);
  }

  async checkProximity(tripId, currentLat, currentLng) {
    try {
      const activeWatches = await this.watchRepository.getActiveWatchesForTrip(tripId);
      if (!activeWatches || activeWatches.length === 0) return;

      const crossings = [];

      for (const watch of activeWatches) {
        if (!watch.stops) continue;

        const stopLat = watch.stops.latitude;
        const stopLng = watch.stops.longitude;
        const radius = watch.stops.geofence_radius_meters || this.defaultRadiusMeters;

        const distance = haversineDistanceMeters(currentLat, currentLng, stopLat, stopLng);

        if (distance <= radius) {
          crossings.push({ watch, distanceMeters: Math.round(distance) });
        }
      }

      if (crossings.length === 0) return;

      await this.watchRepository.markAsAlerted(crossings.map((c) => c.watch.id));

      for (const { watch, distanceMeters } of crossings) {
        this._emitAlert(watch.user_id, watch.trip_id, watch.stop_id, distanceMeters);
        this._dispatchPush(watch, distanceMeters);
      }
    } catch (err) {
      console.error("Error en checkProximity:", err.message);
    }
  }

  _emitAlert(userId, tripId, stopId, distanceMeters) {
    if (!this.realtimeManager) return;
    this.realtimeManager.emitUserAlert(userId, "bus_approaching", {
      passenger_id: userId,
      trip_id: tripId,
      stop_id: stopId,
      distance_m: distanceMeters,
    });
  }

  async _dispatchPush(watch, distanceMeters) {
    if (!this.pushService) return;
    try {
      await this.pushService.sendGeofenceAlert({
        passenger_id: watch.user_id,
        trip_id: watch.trip_id,
        stop_id: watch.stop_id,
        distance_m: distanceMeters,
      });
    } catch (err) {
      console.error("Error dispatching geofence push:", err.message);
    }
  }
}

module.exports = PassengerTrackingService;
