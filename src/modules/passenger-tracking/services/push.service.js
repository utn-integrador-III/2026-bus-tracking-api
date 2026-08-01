"use strict";

const passengerRepository = require("../../../../repositories/passengerRepository");

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN_PREFIXES = ["ExponentPushToken[", "ExpoPushToken["];
const PUSH_CHANNEL_ID = "bus-alerts";

const ALERT_CONTENT = {
  bus_approaching: {
    title: "Tu bus esta por llegar",
    body: "El bus se esta acercando a tu parada.",
  },
  bus_passed: {
    title: "El bus paso tu parada",
    body: "El bus ya paso por la parada que estabas monitoreando.",
  },
};

function isExpoPushToken(token) {
  return (
    typeof token === "string" &&
    EXPO_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))
  );
}

function logPush(level, fields) {
  const line = JSON.stringify({ scope: "passenger_push", ...fields });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.warn(line);
}

class ExpoPushService {
  constructor(dependencies = {}) {
    this.passengerRepository = dependencies.passengerRepository || passengerRepository;
    this.endpoint = dependencies.endpoint || EXPO_PUSH_ENDPOINT;
    this.fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  }

  async _resolveToken(userId) {
    const passenger = await this.passengerRepository.findPassengerById(userId);
    return passenger ? passenger.expo_push_token : null;
  }

  async sendAlert(userId, event, payload) {
    const content = ALERT_CONTENT[event];
    if (!content) {
      return false;
    }

    if (typeof this.fetchImpl !== "function") {
      logPush("error", { event: "push_transport_unavailable", user_id: userId, alert: event });
      return false;
    }

    let token = null;
    try {
      token = await this._resolveToken(userId);
    } catch (err) {
      logPush("error", {
        event: "push_token_lookup_failed",
        user_id: userId,
        alert: event,
        error: err.message,
      });
      return false;
    }

    if (!isExpoPushToken(token)) {
      logPush("warn", { event: "push_token_missing", user_id: userId, alert: event });
      return false;
    }

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to: token,
          sound: "default",
          priority: "high",
          channelId: PUSH_CHANNEL_ID,
          title: content.title,
          body: content.body,
          data: { event, ...payload },
        }),
      });

      if (!response || response.ok !== true) {
        logPush("error", {
          event: "push_dispatch_failed",
          user_id: userId,
          alert: event,
          status: response ? response.status : null,
        });
        return false;
      }

      return true;
    } catch (err) {
      logPush("error", {
        event: "push_dispatch_failed",
        user_id: userId,
        alert: event,
        error: err.message,
      });
      return false;
    }
  }
}

module.exports = ExpoPushService;
module.exports.EXPO_PUSH_ENDPOINT = EXPO_PUSH_ENDPOINT;
module.exports.isExpoPushToken = isExpoPushToken;
