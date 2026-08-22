"use strict";

const { env } = require("../config/env");

function resolveFunctionsBaseUrl() {
  if (env.supabaseFunctionsUrl) {
    return env.supabaseFunctionsUrl;
  }
  if (env.supabaseUrl) {
    return `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1`;
  }
  return "";
}

class PushNotificationsService {
  constructor(dependencies = {}) {
    this.fetchFn = dependencies.fetchFn || globalThis.fetch;
    this.functionsBaseUrl = (dependencies.functionsBaseUrl || resolveFunctionsBaseUrl()).replace(/\/+$/, "");
    this.authToken = dependencies.authToken || env.supabaseServiceRoleKey;
    this.enabled = dependencies.enabled ?? env.enablePushNotifications;
  }

  async sendGeofenceAlert(payload) {
    if (!this.enabled) {
      return { skipped: true, reason: "push_disabled" };
    }
    if (!this.functionsBaseUrl) {
      return { skipped: true, reason: "functions_url_missing" };
    }
    if (typeof this.fetchFn !== "function") {
      return { skipped: true, reason: "fetch_unavailable" };
    }

    const url = `${this.functionsBaseUrl}/geofence-alert`;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        passenger_id: payload.passenger_id,
        distance_m: payload.distance_m,
        trip_id: payload.trip_id,
        stop_id: payload.stop_id,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`geofence-alert function failed (${response.status}): ${detail}`);
    }

    return response.json().catch(() => ({ ok: true }));
  }
}

module.exports = { PushNotificationsService };
