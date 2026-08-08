"use strict";

const passengerRepository = require("../../../../repositories/passengerRepository");

const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

class PassengerPushTokenService {
  constructor(dependencies = {}) {
    this.passengerRepository = dependencies.passengerRepository || passengerRepository;
  }

  async registerToken(userId, expoPushToken) {
    const updated = await this.passengerRepository.updatePassengerProfile(userId, {
      expo_push_token: expoPushToken,
    });

    if (updated) {
      return updated;
    }

    return this.passengerRepository.createPassengerProfile({
      user_id: userId,
      expo_push_token: expoPushToken,
    });
  }
}

module.exports = PassengerPushTokenService;
module.exports.EXPO_PUSH_TOKEN_PATTERN = EXPO_PUSH_TOKEN_PATTERN;
