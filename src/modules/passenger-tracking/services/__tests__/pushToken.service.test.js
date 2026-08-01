"use strict";

const PassengerPushTokenService = require("../pushToken.service");
const { EXPO_PUSH_TOKEN_PATTERN } = require("../pushToken.service");

const TOKEN = "ExponentPushToken[abcdef123456]";

function buildRepository(overrides = {}) {
  return {
    updatePassengerProfile: jest.fn().mockResolvedValue({
      user_id: "user-1",
      expo_push_token: TOKEN,
    }),
    createPassengerProfile: jest.fn().mockResolvedValue({
      user_id: "user-1",
      expo_push_token: TOKEN,
    }),
    ...overrides,
  };
}

describe("EXPO_PUSH_TOKEN_PATTERN", () => {
  it("accepts Expo tokens and rejects FCM style tokens", () => {
    expect(EXPO_PUSH_TOKEN_PATTERN.test(TOKEN)).toBe(true);
    expect(EXPO_PUSH_TOKEN_PATTERN.test("ExpoPushToken[xyz]")).toBe(true);
    expect(EXPO_PUSH_TOKEN_PATTERN.test("dGhpcyBpcyBhbiBmY20gdG9rZW4")).toBe(false);
    expect(EXPO_PUSH_TOKEN_PATTERN.test("ExponentPushToken[]")).toBe(false);
  });
});

describe("PassengerPushTokenService.registerToken", () => {
  it("updates the existing passenger profile", async () => {
    const repository = buildRepository();
    const service = new PassengerPushTokenService({ passengerRepository: repository });

    const result = await service.registerToken("user-1", TOKEN);

    expect(repository.updatePassengerProfile).toHaveBeenCalledWith("user-1", {
      expo_push_token: TOKEN,
    });
    expect(repository.createPassengerProfile).not.toHaveBeenCalled();
    expect(result).toEqual({ user_id: "user-1", expo_push_token: TOKEN });
  });

  it("creates the passenger profile when none exists yet", async () => {
    const repository = buildRepository({
      updatePassengerProfile: jest.fn().mockResolvedValue(null),
    });
    const service = new PassengerPushTokenService({ passengerRepository: repository });

    const result = await service.registerToken("user-1", TOKEN);

    expect(repository.createPassengerProfile).toHaveBeenCalledWith({
      user_id: "user-1",
      expo_push_token: TOKEN,
    });
    expect(result).toEqual({ user_id: "user-1", expo_push_token: TOKEN });
  });

  it("propagates repository failures", async () => {
    const repository = buildRepository({
      updatePassengerProfile: jest.fn().mockRejectedValue(new Error("db down")),
    });
    const service = new PassengerPushTokenService({ passengerRepository: repository });

    await expect(service.registerToken("user-1", TOKEN)).rejects.toThrow("db down");
  });
});
