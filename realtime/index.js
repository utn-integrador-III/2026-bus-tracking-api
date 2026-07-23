"use strict";

const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");
const { env } = require("../config/env");

const CHANNEL_PREFIX = "trip";

class TripRealtimeManager {
  constructor() {
    this.channels = new Map();
    this.client = null;
  }

  _getClient() {
    if (!this.client) {
      this.client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: { transport: WebSocket },
      });
    }
    return this.client;
  }

  _channelName(tripId) {
    return `${CHANNEL_PREFIX}:${tripId}:driver-location`;
  }

  async startTracking(tripId) {
    if (!env.enableSupabaseRealtime) {
      return;
    }
    if (this.channels.has(tripId)) {
      return;
    }

    const channel = this._getClient().channel(this._channelName(tripId));

    return new Promise((resolve, reject) => {
      channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          this.channels.set(tripId, channel);
          resolve();
        } else {
          reject(err || new Error(`Channel subscribe returned ${status}`));
        }
      });
    });
  }

  async stopTracking(tripId) {
    const channel = this.channels.get(tripId);
    if (!channel) {
      return;
    }

    await channel.unsubscribe();
    this.channels.delete(tripId);
  }

  async broadcastLocation(tripId, location) {
    if (!env.enableSupabaseRealtime) {
      return;
    }

    const channel = this.channels.get(tripId);
    if (!channel) {
      return;
    }

    await channel.send({
      type: "broadcast",
      event: "location",
      payload: {
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed ?? null,
        heading: location.heading ?? null,
        recorded_at: location.recorded_at || new Date().toISOString(),
      },
    });
  }

  async emitUserAlert(userId, event, payload) {
    if (!env.enableSupabaseRealtime) {
      return;
    }

    const channelName = `passenger:${userId}:alerts`;

    let channel = this.channels.get(channelName);
    let isTemp = false;

    if (!channel) {
      channel = this._getClient().channel(channelName);
      isTemp = true;
      await new Promise((resolve, reject) => {
        channel.subscribe((status, err) => {
          if (status === "SUBSCRIBED") resolve();
          else reject(err || new Error(`Subscribe failed: ${status}`));
        });
      }).catch(err => console.error("Error subscribing to temp channel:", err.message));
    }

    await channel.send({
      type: "broadcast",
      event: event,
      payload: payload,
    });

    if (isTemp) {
      await channel.unsubscribe();
    }
  }

  async stopAllTracking() {
    const entries = Array.from(this.channels.entries());
    for (const [tripId] of entries) {
      await this.stopTracking(tripId);
    }
  }
}

module.exports = new TripRealtimeManager();
