"use strict";

const { env } = require("../config/env");
const tripsRepository = require("../repositories/tripsRepository");
const locationRepository = require("../repositories/locationRepository");
const { CONSUMER_VISIBLE_STATUSES } = require("../constants/tripStatus");
const { createPassengerTrackingModule } = require("../src/modules/passenger-tracking/index");

class ProximityWorker {
  constructor(dependencies = {}) {
    this.trackingService = dependencies.trackingService;
    this.tripsRepository = dependencies.tripsRepository || tripsRepository;
    this.locationRepository = dependencies.locationRepository || locationRepository;
    this.statuses = dependencies.statuses || CONSUMER_VISIBLE_STATUSES;
    this.intervalMs = dependencies.intervalMs ?? env.proximityWorkerIntervalSeconds * 1000;
    this.running = false;
    this.timer = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._scheduleNext(0);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  _scheduleNext(delay) {
    if (!this.running) return;
    this.timer = setTimeout(() => this._run(), delay);
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  async _run() {
    try {
      await this.tick();
    } catch (err) {
      console.error("ProximityWorker tick failed:", err.message);
    } finally {
      this._scheduleNext(this.intervalMs);
    }
  }

  async tick() {
    const trips = await this.tripsRepository.listTrips({ statuses: this.statuses });
    if (!trips || trips.length === 0) return;

    for (const trip of trips) {
      const location = await this.locationRepository.getLatestByTripId(trip.id);
      if (!location) continue;
      await this.trackingService.checkProximity(
        trip.id,
        location.latitude,
        location.longitude,
      );
    }
  }
}

function createProximityWorker(dependencies = {}) {
  const trackingService =
    dependencies.trackingService || createPassengerTrackingModule().trackingService;
  return new ProximityWorker({ ...dependencies, trackingService });
}

module.exports = { ProximityWorker, createProximityWorker };
