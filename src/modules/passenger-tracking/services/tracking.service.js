"use strict";

const { haversineDistanceMeters } = require("../../../../utils/distance");

class PassengerTrackingService {
  constructor(dependencies = {}) {
    this.watchRepository = dependencies.watchRepository;
    this.realtimeManager = dependencies.realtimeManager;
  }

  async watchStop(userId, tripId, stopId) {
    return this.watchRepository.addWatch(userId, tripId, stopId);
  }

  async checkProximity(tripId, currentLat, currentLng) {
    try {
      const activeWatches = await this.watchRepository.getActiveWatchesForTrip(tripId);
      if (!activeWatches || activeWatches.length === 0) return;

      const alertedWatchIds = [];

      for (const watch of activeWatches) {
        if (!watch.stops) continue;

        const stopLat = watch.stops.latitude;
        const stopLng = watch.stops.longitude;
        const radius = watch.stops.geofence_radius_meters || 500;

        const distance = haversineDistanceMeters(currentLat, currentLng, stopLat, stopLng);

        if (distance <= radius) {
          alertedWatchIds.push(watch.id);
          this._emitAlert(watch.user_id, watch.trip_id, watch.stop_id);
        }
      }

      if (alertedWatchIds.length > 0) {
        await this.watchRepository.markAsAlerted(alertedWatchIds);
      }
    } catch (err) {
      console.error("Error en checkProximity:", err.message);
    }
  }

  _emitAlert(userId, tripId, stopId) {
    if (!this.realtimeManager) return;
    this.realtimeManager.emitUserAlert(userId, "bus_approaching", {
      trip_id: tripId,
      stop_id: stopId,
    });
  }
}

module.exports = PassengerTrackingService;
